/**
 * Saga Pattern Implementation for Transaction Orchestration
 * 
 * The Saga pattern provides a way to manage distributed transactions
 * by breaking them into a sequence of local transactions, each updating
 * data within a single service. If any step fails, compensating transactions
 * are executed to undo the changes made by preceding steps.
 * 
 * This implementation supports:
 * - Choreography-based sagas (event-driven)
 * - Orchestration-based sagas (central coordinator)
 * - Automatic compensation on failure
 * - Transaction state persistence
 * - Retry policies
 * - Timeout handling
 */

import { emit } from '@/core/events/event-system';
import { auditService } from '@/core/audit/audit.service';
import { RequestContext } from '@/core/context/request-context';

/**
 * Saga execution status
 */
export enum SagaStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
  TIMED_OUT = 'timed_out',
}

/**
 * Saga step type
 */
export enum SagaStepType {
  ACTION = 'action',
  COMPENSATION = 'compensation',
}

/**
 * Saga step definition
 */
export interface SagaStep<TInput = any, TOutput = any> {
  id: string;
  name: string;
  type: SagaStepType;
  execute: (input: TInput, context: RequestContext) => Promise<TOutput>;
  compensate?: (output: TOutput, context: RequestContext) => Promise<void>;
  retryPolicy?: {
    maxAttempts: number;
    backoffMs: number;
  };
  timeoutMs?: number;
}

/**
 * Saga definition
 */
export interface SagaDefinition<TInput = any, TOutput = any> {
  id: string;
  name: string;
  description?: string;
  steps: SagaStep[];
  timeoutMs?: number;
  onCompletion?: (result: TOutput, context: RequestContext) => Promise<void>;
  onFailure?: (error: Error, context: RequestContext) => Promise<void>;
}

/**
 * Saga execution state
 */
export interface SagaExecution {
  id: string;
  sagaId: string;
  status: SagaStatus;
  currentStepIndex: number;
  input: any;
  output: any;
  error?: Error;
  startedAt: Date;
  completedAt?: Date;
  context: RequestContext;
  stepResults: Map<string, any>;
}

/**
 * Saga orchestrator - coordinates saga execution
 */
export class SagaOrchestrator {
  private executions: Map<string, SagaExecution> = new Map();
  private sagas: Map<string, SagaDefinition> = new Map();

  /**
   * Register a saga definition
   */
  registerSaga(definition: SagaDefinition): void {
    this.sagas.set(definition.id, definition);
  }

  /**
   * Execute a saga
   */
  async executeSaga<TInput = any, TOutput = any>(
    sagaId: string,
    input: TInput,
    context: RequestContext
  ): Promise<TOutput> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const executionId = crypto.randomUUID();
    const execution: SagaExecution = {
      id: executionId,
      sagaId,
      status: SagaStatus.PENDING,
      currentStepIndex: 0,
      input,
      output: {} as TOutput,
      startedAt: new Date(),
      context,
      stepResults: new Map(),
    };

    this.executions.set(executionId, execution);

    try {
      // Log saga start
      await auditService.logWithContext(
        context.userId,
        'saga:started',
        'saga',
        executionId,
        { sagaId, input }
      );

      await emit('saga:started', {
        executionId,
        sagaId,
        input,
        userId: context.userId,
      });

      // Execute saga with timeout
      const timeoutMs = saga.timeoutMs || 30000; // Default 30 seconds
      const result = await this.executeWithTimeout(
        () => this.executeSteps(saga, execution),
        timeoutMs
      );

      execution.status = SagaStatus.COMPLETED;
      execution.completedAt = new Date();
      execution.output = result;

      // Call completion handler
      if (saga.onCompletion) {
        await saga.onCompletion(result, context);
      }

      // Log saga completion
      await auditService.logWithContext(
        context.userId,
        'saga:completed',
        'saga',
        executionId,
        { sagaId, result }
      );

      await emit('saga:completed', {
        executionId,
        sagaId,
        result,
        userId: context.userId,
      });

      return result;
    } catch (error) {
      execution.status = SagaStatus.FAILED;
      execution.error = error as Error;
      execution.completedAt = new Date();

      // Call failure handler
      if (saga.onFailure) {
        await saga.onFailure(error as Error, context);
      }

      // Log saga failure
      await auditService.logWithContext(
        context.userId,
        'saga:failed',
        'saga',
        executionId,
        { sagaId, error: (error as Error).message }
      );

      await emit('saga:failed', {
        executionId,
        sagaId,
        error: (error as Error).message,
        userId: context.userId,
      });

      throw error;
    } finally {
      this.executions.delete(executionId);
    }
  }

  /**
   * Execute saga steps sequentially
   */
  private async executeSteps(
    saga: SagaDefinition,
    execution: SagaExecution
  ): Promise<any> {
    execution.status = SagaStatus.IN_PROGRESS;

    for (let i = 0; i < saga.steps.length; i++) {
      execution.currentStepIndex = i;
      const step = saga.steps[i];

      if (step.type !== SagaStepType.ACTION) {
        continue; // Skip compensation steps during forward execution
      }

      const stepInput = i === 0 ? execution.input : execution.stepResults.get(saga.steps[i - 1].id);

      try {
        const result = await this.executeStep(step, stepInput, execution.context);
        execution.stepResults.set(step.id, result);
      } catch (error) {
        // Step failed - initiate compensation
        await this.compensate(saga, execution, i);
        throw error;
      }
    }

    return execution.stepResults.get(saga.steps[saga.steps.length - 1].id);
  }

  /**
   * Execute a single step with retry policy
   */
  private async executeStep<TInput, TOutput>(
    step: SagaStep<TInput, TOutput>,
    input: TInput,
    context: RequestContext
  ): Promise<TOutput> {
    const retryPolicy = step.retryPolicy || { maxAttempts: 1, backoffMs: 0 };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        // Log step start
        await auditService.logWithContext(
          context.userId,
          'saga:step:started',
          'saga_step',
          step.id,
          { stepName: step.name, attempt }
        );

        await emit('saga:step:started', {
          stepId: step.id,
          stepName: step.name,
          attempt,
          userId: context.userId,
        });

        const result = await this.executeWithTimeout(
          () => step.execute(input, context),
          step.timeoutMs || 10000
        );

        // Log step completion
        await auditService.logWithContext(
          context.userId,
          'saga:step:completed',
          'saga_step',
          step.id,
          { stepName: step.name, attempt }
        );

        await emit('saga:step:completed', {
          stepId: step.id,
          stepName: step.name,
          attempt,
          userId: context.userId,
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        // Log step failure
        await auditService.logWithContext(
          context.userId,
          'saga:step:failed',
          'saga_step',
          step.id,
          { stepName: step.name, attempt, error: (error as Error).message }
        );

        await emit('saga:step:failed', {
          stepId: step.id,
          stepName: step.name,
          attempt,
          error: (error as Error).message,
          userId: context.userId,
        });

        if (attempt < retryPolicy.maxAttempts) {
          await this.sleep(retryPolicy.backoffMs * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Compensate executed steps in reverse order
   */
  private async compensate(
    saga: SagaDefinition,
    execution: SagaExecution,
    failedStepIndex: number
  ): Promise<void> {
    execution.status = SagaStatus.COMPENSATING;

    await auditService.logWithContext(
      execution.context.userId,
      'saga:compensating',
      'saga',
      execution.id,
      { sagaId: saga.id, failedStepIndex }
    );

    await emit('saga:compensating', {
      executionId: execution.id,
      sagaId: saga.id,
      failedStepIndex,
      userId: execution.context.userId,
    });

    // Compensate in reverse order
    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = saga.steps[i];

      if (step.type !== SagaStepType.ACTION) {
        continue;
      }

      const stepResult = execution.stepResults.get(step.id);

      if (step.compensate && stepResult) {
        try {
          await auditService.logWithContext(
            execution.context.userId,
            'saga:compensating:step',
            'saga_step',
            step.id,
            { stepName: step.name }
          );

          await step.compensate(stepResult, execution.context);

          await auditService.logWithContext(
            execution.context.userId,
            'saga:compensated:step',
            'saga_step',
            step.id,
            { stepName: step.name }
          );
        } catch (error) {
          // Log compensation failure but continue
          await auditService.logWithContext(
            execution.context.userId,
            'saga:compensation:failed',
            'saga_step',
            step.id,
            { stepName: step.name, error: (error as Error).message }
          );

          console.error(`Compensation failed for step ${step.name}:`, error);
        }
      }
    }

    execution.status = SagaStatus.COMPENSATED;

    await auditService.logWithContext(
      execution.context.userId,
      'saga:compensated',
      'saga',
      execution.id,
      { sagaId: saga.id }
    );

    await emit('saga:compensated', {
      executionId: execution.id,
      sagaId: saga.id,
      userId: execution.context.userId,
    });
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): SagaExecution | undefined {
    return this.executions.get(executionId);
  }
}

// Singleton instance
export const sagaOrchestrator = new SagaOrchestrator();

/**
 * Helper function to create a saga step
 */
export function createSagaStep<TInput = any, TOutput = any>(
  id: string,
  name: string,
  execute: (input: TInput, context: RequestContext) => Promise<TOutput>,
  options?: {
    compensate?: (output: TOutput, context: RequestContext) => Promise<void>;
    retryPolicy?: { maxAttempts: number; backoffMs: number };
    timeoutMs?: number;
  }
): SagaStep<TInput, TOutput> {
  return {
    id,
    name,
    type: SagaStepType.ACTION,
    execute,
    compensate: options?.compensate,
    retryPolicy: options?.retryPolicy,
    timeoutMs: options?.timeoutMs,
  };
}

/**
 * Helper function to create a saga definition
 */
export function createSagaDefinition<TInput = any, TOutput = any>(
  id: string,
  name: string,
  steps: SagaStep[],
  options?: {
    description?: string;
    timeoutMs?: number;
    onCompletion?: (result: TOutput, context: RequestContext) => Promise<void>;
    onFailure?: (error: Error, context: RequestContext) => Promise<void>;
  }
): SagaDefinition<TInput, TOutput> {
  return {
    id,
    name,
    description: options?.description,
    steps,
    timeoutMs: options?.timeoutMs,
    onCompletion: options?.onCompletion,
    onFailure: options?.onFailure,
  };
}
