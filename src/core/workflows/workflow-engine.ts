/**
 * Workflow Engine
 * 
 * Core workflow orchestration system that supports:
 * - Event-triggered workflows
 * - Conditional execution
 * - Step-by-step actions
 * - Retry policies
 * - Failure handling
 * 
 * Supported actions:
 * - sendNotification()
 * - sendEmail()
 * - sendSMS()
 * - createAuditLog()
 * - triggerLedgerEntry()
 * - callExternalWebhook()
 */

import { BaseService } from '@/services/base.service';
import { RequestContext } from '@/core/context/request-context';
import { Permission } from '@/core/rbac/permissions';
import { supabase } from '@/integrations/supabase/client';
import { emit } from '@/core/events/event-system';
import { observabilityService } from '@/core/observability/observability.service';
import { ledgerService } from '@/services/ledger/ledger.service';
import { auditService } from '@/core/audit/audit.service';
import { notificationEngine } from '@/core/notifications/notification-engine';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  name: string;
  action: string;
  config: Record<string, any>;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  conditions?: Record<string, any>;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id?: string;
  name: string;
  description?: string;
  triggerEvent: string;
  conditions?: {
    requiredPermissions?: Permission[];
    branchId?: string;
    payloadRules?: Record<string, any>;
  };
  steps: WorkflowStep[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  failureHandling?: {
    notifyOnError?: boolean;
    deadLetterQueue?: boolean;
  };
  isActive?: boolean;
  branchId?: string;
}

/**
 * Workflow execution status
 */
export enum WorkflowExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRIED = 'retried',
}

/**
 * Workflow execution
 */
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  branchId: string;
  status: WorkflowExecutionStatus;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  correlationId?: string;
  createdAt: Date;
}

/**
 * Workflow step execution status
 */
export enum StepExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * Workflow step execution
 */
export interface WorkflowStepExecution {
  id: string;
  workflowExecutionId: string;
  stepName: string;
  status: StepExecutionStatus;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  errorMessage?: string;
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

/**
 * Workflow Engine
 */
export class WorkflowEngine extends BaseService {
  private supabase = supabase;
  private activeWorkflows: Map<string, WorkflowDefinition> = new Map();
  private runningExecutions: Map<string, Promise<void>> = new Map();

  constructor() {
    super();
    this.loadActiveWorkflows();
  }

  /**
   * Load active workflows from database
   */
  private async loadActiveWorkflows(): Promise<void> {
    const { data, error } = await this.supabase
      .from('workflow_definitions' as any)
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('[WorkflowEngine] Failed to load workflows:', error);
      return;
    }

    for (const workflow of data || []) {
      this.activeWorkflows.set(workflow.id, {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        triggerEvent: workflow.trigger_event,
        conditions: workflow.conditions,
        steps: workflow.steps,
        retryPolicy: workflow.retry_policy,
        failureHandling: workflow.failure_handling,
        isActive: workflow.is_active,
        branchId: workflow.branch_id,
      });
    }
  }

  /**
   * Register a workflow definition
   */
  async registerWorkflow(
    definition: WorkflowDefinition,
    context: RequestContext
  ): Promise<string> {
    this.requirePermission(context, Permission.AUDIT_VIEW);

    const { data, error } = await this.supabase
      .from('workflow_definitions' as any)
      .insert({
        id: definition.id || crypto.randomUUID(),
        name: definition.name,
        description: definition.description,
        trigger_event: definition.triggerEvent,
        conditions: definition.conditions,
        steps: definition.steps,
        retry_policy: definition.retryPolicy,
        failure_handling: definition.failureHandling,
        is_active: definition.isActive ?? true,
        branch_id: definition.branchId || context.branchId,
        created_by: context.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    this.activeWorkflows.set(data.id, {
      ...definition,
      id: data.id,
      branchId: data.branch_id,
    });

    return data.id;
  }

  /**
   * Trigger workflow execution
   */
  async triggerWorkflow(
    workflowId: string,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<string> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check conditions
    if (!this.checkConditions(workflow, inputData, context)) {
      throw new Error('Workflow conditions not met');
    }

    // Create workflow execution
    const executionId = await this.createExecution(workflowId, inputData, context);

    // Execute workflow asynchronously
    const executionPromise = this.executeWorkflow(executionId, workflow, inputData, context);
    this.runningExecutions.set(executionId, executionPromise);

    return executionId;
  }

  /**
   * Handle event and trigger matching workflows
   */
  async handleEvent(
    eventType: string,
    eventData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    const span = observabilityService.startTrace('workflow_engine.handle_event', {
      eventType,
      correlationId: eventData.correlationId,
    });

    try {
      // Find workflows triggered by this event
      const matchingWorkflows = Array.from(this.activeWorkflows.values()).filter(
        w => w.triggerEvent === eventType || this.matchesWildcard(w.triggerEvent, eventType)
      );

      for (const workflow of matchingWorkflows) {
        // Check branch isolation
        if (workflow.branchId && workflow.branchId !== context.branchId) {
          continue;
        }

        try {
          await this.triggerWorkflow(workflow.id!, eventData, context);
        } catch (error) {
          console.error(`[WorkflowEngine] Failed to trigger workflow ${workflow.id}:`, error);
        }
      }

      span.end();
    } catch (error) {
      span.end();
      this.handleError(error, context);
    }
  }

  /**
   * Check if event pattern matches wildcard
   */
  private matchesWildcard(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return eventType.startsWith(prefix);
    }
    return false;
  }

  /**
   * Check workflow conditions
   */
  private checkConditions(
    workflow: WorkflowDefinition,
    inputData: Record<string, any>,
    context: RequestContext
  ): boolean {
    // Check permissions
    if (workflow.conditions?.requiredPermissions) {
      for (const permission of workflow.conditions.requiredPermissions) {
        if (!this.checkPermission(context, permission)) {
          return false;
        }
      }
    }

    // Check branch
    if (workflow.conditions?.branchId && workflow.conditions.branchId !== context.branchId) {
      return false;
    }

    // Check payload rules
    if (workflow.conditions?.payloadRules) {
      for (const [key, value] of Object.entries(workflow.conditions.payloadRules)) {
        if (inputData[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Create workflow execution record
   */
  private async createExecution(
    workflowId: string,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('workflow_executions' as any)
      .insert({
        id: crypto.randomUUID(),
        workflow_id: workflowId,
        branch_id: context.branchId,
        status: WorkflowExecutionStatus.PENDING,
        input_data: inputData,
        output_data: {},
        retry_count: 0,
        max_retries: 3,
        correlation_id: inputData.correlationId || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return data.id;
  }

  /**
   * Execute workflow
   */
  private async executeWorkflow(
    executionId: string,
    workflow: WorkflowDefinition,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    try {
      // Update status to running
      await this.updateExecutionStatus(executionId, WorkflowExecutionStatus.RUNNING);

      // Execute steps sequentially
      const outputData: Record<string, any> = {};
      for (const step of workflow.steps) {
        const stepOutput = await this.executeStep(executionId, step, inputData, outputData, context);
        outputData[step.name] = stepOutput;
      }

      // Update status to completed
      await this.updateExecutionStatus(executionId, WorkflowExecutionStatus.COMPLETED, outputData);

      // Emit success event
      await emit('workflow:completed', {
        executionId,
        workflowId: workflow.id,
        branchId: context.branchId,
      } as any);
    } catch (error) {
      // Update status to failed
      await this.updateExecutionStatus(
        executionId,
        WorkflowExecutionStatus.FAILED,
        undefined,
        error instanceof Error ? error.message : String(error)
      );

      // Handle retry
      const execution = await this.getExecution(executionId, context);
      if (execution && execution.retryCount < execution.maxRetries) {
        await this.retryWorkflow(executionId, workflow, inputData, context);
      } else {
        // Move to dead letter queue
        if (workflow.failureHandling?.deadLetterQueue) {
          await this.moveToDeadLetterQueue(workflow, inputData, error, context);
        }

        // Notify on error
        if (workflow.failureHandling?.notifyOnError) {
          await this.notifyWorkflowError(workflow, error, context);
        }
      }

      throw error;
    } finally {
      this.runningExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    executionId: string,
    step: WorkflowStep,
    inputData: Record<string, any>,
    previousOutputs: Record<string, any>,
    context: RequestContext
  ): Promise<any> {
    // Create step execution record
    const stepExecutionId = await this.createStepExecution(executionId, step);

    try {
      // Update status to running
      await this.updateStepExecutionStatus(stepExecutionId, StepExecutionStatus.RUNNING);

      // Execute action
      const output = await this.executeAction(step.action, step.config, inputData, previousOutputs, context);

      // Update status to completed
      await this.updateStepExecutionStatus(stepExecutionId, StepExecutionStatus.COMPLETED, undefined, output);

      return output;
    } catch (error) {
      // Update status to failed
      await this.updateStepExecutionStatus(
        stepExecutionId,
        StepExecutionStatus.FAILED,
        error instanceof Error ? error.message : String(error)
      );

      throw error;
    }
  }

  /**
   * Execute an action
   */
  private async executeAction(
    action: string,
    config: Record<string, any>,
    inputData: Record<string, any>,
    previousOutputs: Record<string, any>,
    context: RequestContext
  ): Promise<any> {
    switch (action) {
      case 'sendNotification':
        return await this.actionSendNotification(config, inputData, context);
      case 'sendEmail':
        return await this.actionSendEmail(config, inputData, context);
      case 'sendSMS':
        return await this.actionSendSMS(config, inputData, context);
      case 'createAuditLog':
        return await this.actionCreateAuditLog(config, inputData, context);
      case 'triggerLedgerEntry':
        return await this.actionTriggerLedgerEntry(config, inputData, context);
      case 'callExternalWebhook':
        return await this.actionCallExternalWebhook(config, inputData, context);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Action: Send notification
   */
  private async actionSendNotification(
    config: Record<string, any>,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    const { userId, title, message, type, metadata } = config;
    
    await notificationEngine.handleEvent('notification.custom', {
      userId,
      title: this.interpolateTemplate(title, inputData),
      message: this.interpolateTemplate(message, inputData),
      type: type || 'info',
      metadata: { ...metadata, ...inputData },
    }, context);
  }

  /**
   * Action: Send email
   */
  private async actionSendEmail(
    config: Record<string, any>,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    // Stub implementation - integrate with email service
    console.log('[WorkflowEngine] Sending email:', {
      to: config.to,
      subject: this.interpolateTemplate(config.subject, inputData),
      body: this.interpolateTemplate(config.body, inputData),
    });
  }

  /**
   * Action: Send SMS
   */
  private async actionSendSMS(
    config: Record<string, any>,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    // Stub implementation - integrate with SMS service
    console.log('[WorkflowEngine] Sending SMS:', {
      to: config.to,
      message: this.interpolateTemplate(config.message, inputData),
    });
  }

  /**
   * Action: Create audit log
   */
  private async actionCreateAuditLog(
    config: Record<string, any>,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    await auditService.log({
      actor_id: context.userId,
      action: config.action || 'workflow_action',
      entity_type: config.entityType || 'workflow',
      entity_id: config.entityId || inputData.correlationId,
      branch_id: context.branchId,
      metadata: {
        ...config.metadata,
        ...inputData,
      },
    });
  }

  /**
   * Action: Trigger ledger entry
   */
  private async actionTriggerLedgerEntry(
    config: Record<string, any>,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    const { transactionType, amount, studentId, paymentMethod } = config;

    switch (transactionType) {
      case 'fee_payment':
        await ledgerService.recordFeePayment(
          context,
          studentId || inputData.studentId,
          amount || inputData.amount,
          paymentMethod || inputData.paymentMethod,
          {
            referenceId: inputData.correlationId,
          }
        );
        break;
      case 'invoice_generation':
        await ledgerService.recordInvoiceGeneration(
          context,
          studentId || inputData.studentId,
          inputData.invoiceId,
          amount || inputData.amount,
          config.description || 'Invoice generated'
        );
        break;
      case 'expense_recording':
        await ledgerService.recordExpense(
          context,
          config.expenseType || inputData.expenseType,
          amount || inputData.amount,
          paymentMethod || inputData.paymentMethod,
          config.description || 'Expense recorded',
          {
            referenceId: inputData.correlationId,
          }
        );
        break;
      default:
        throw new Error(`Unknown transaction type: ${transactionType}`);
    }
  }

  /**
   * Action: Call external webhook
   */
  private async actionCallExternalWebhook(
    config: Record<string, any>,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    const { url, method = 'POST', headers = {} } = config;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        ...inputData,
        correlationId: inputData.correlationId,
        branchId: context.branchId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Create step execution record
   */
  private async createStepExecution(
    executionId: string,
    step: WorkflowStep
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('workflow_step_executions' as any)
      .insert({
        id: crypto.randomUUID(),
        workflow_execution_id: executionId,
        step_name: step.name,
        status: StepExecutionStatus.PENDING,
        input_data: step.config,
        output_data: {},
        retry_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return data.id;
  }

  /**
   * Update execution status
   */
  private async updateExecutionStatus(
    executionId: string,
    status: WorkflowExecutionStatus,
    outputData?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === WorkflowExecutionStatus.RUNNING) {
      updateData.started_at = new Date().toISOString();
    } else if (status === WorkflowExecutionStatus.COMPLETED || status === WorkflowExecutionStatus.FAILED) {
      updateData.completed_at = new Date().toISOString();
    }

    if (outputData) {
      updateData.output_data = outputData;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('workflow_executions' as any)
      .update(updateData)
      .eq('id', executionId);

    if (error) throw error;
  }

  /**
   * Update step execution status
   */
  private async updateStepExecutionStatus(
    stepExecutionId: string,
    status: StepExecutionStatus,
    errorMessage?: string,
    outputData?: Record<string, any>
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === StepExecutionStatus.RUNNING) {
      updateData.started_at = new Date().toISOString();
    } else if (status === StepExecutionStatus.COMPLETED || status === StepExecutionStatus.FAILED) {
      updateData.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    if (outputData) {
      updateData.output_data = outputData;
    }

    const { error } = await this.supabase
      .from('workflow_step_executions' as any)
      .update(updateData)
      .eq('id', stepExecutionId);

    if (error) throw error;
  }

  /**
   * Retry workflow execution
   */
  private async retryWorkflow(
    executionId: string,
    workflow: WorkflowDefinition,
    inputData: Record<string, any>,
    context: RequestContext
  ): Promise<void> {
    await this.updateExecutionStatus(executionId, WorkflowExecutionStatus.RETRIED);

    const execution = await this.getExecution(executionId, context);
    if (!execution) return;

    // Increment retry count
    const { error } = await this.supabase
      .from('workflow_executions' as any)
      .update({
        retry_count: execution.retryCount + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    if (error) throw error;

    // Delay before retry based on backoff
    const backoffMs = workflow.retryPolicy?.backoffMs || 1000;
    await new Promise(resolve => setTimeout(resolve, backoffMs));

    // Re-execute workflow
    await this.executeWorkflow(executionId, workflow, inputData, context);
  }

  /**
   * Move to dead letter queue
   */
  private async moveToDeadLetterQueue(
    workflow: WorkflowDefinition,
    inputData: Record<string, any>,
    error: unknown,
    context: RequestContext
  ): Promise<void> {
    const { error: dbError } = await this.supabase
      .from('dead_letter_queue' as any)
      .insert({
        id: crypto.randomUUID(),
        event_type: workflow.triggerEvent,
        event_data: inputData,
        error_message: error instanceof Error ? error.message : String(error),
        retry_count: 0,
        max_retries: 5,
        branch_id: workflow.branchId || context.branchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (dbError) throw dbError;
  }

  /**
   * Notify workflow error
   */
  private async notifyWorkflowError(
    workflow: WorkflowDefinition,
    error: unknown,
    context: RequestContext
  ): Promise<void> {
    await notificationEngine.handleEvent('system.audit.critical', {
      message: `Workflow ${workflow.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'error',
      component: 'workflow_engine',
    }, context);
  }

  /**
   * Get workflow execution
   */
  private async getExecution(
    executionId: string,
    context: RequestContext
  ): Promise<WorkflowExecution | null> {
    const { data, error } = await this.supabase
      .from('workflow_executions' as any)
      .select('*')
      .eq('id', executionId)
      .eq('branch_id', context.branchId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      workflowId: data.workflow_id,
      branchId: data.branch_id,
      status: data.status,
      inputData: data.input_data,
      outputData: data.output_data,
      errorMessage: data.error_message,
      retryCount: data.retry_count,
      maxRetries: data.max_retries,
      startedAt: data.started_at ? new Date(data.started_at) : undefined,
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      correlationId: data.correlation_id,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Interpolate template with data
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    return result;
  }
}

// Singleton instance
export const workflowEngine = new WorkflowEngine();
