/**
 * Example Workflows
 * 
 * Pre-configured workflow definitions for common use cases:
 * - Student registration workflow
 * - Fee payment workflow
 * - Exam grading workflow
 * - M-Pesa payment workflow
 */

import { workflowEngine, WorkflowDefinition } from './workflow-engine';
import { RequestContext } from '@/core/context/request-context';
import { Permission } from '@/core/rbac/permissions';

/**
 * Student Registration Workflow
 * Triggered when a new student is registered
 */
export const studentRegistrationWorkflow: WorkflowDefinition = {
  name: 'Student Registration',
  description: 'Automated workflow for new student registration',
  triggerEvent: 'student.created',
  conditions: {
    requiredPermissions: [Permission.STUDENT_VIEW],
  },
  steps: [
    {
      name: 'create_student_record',
      action: 'createAuditLog',
      config: {
        action: 'student_created',
        entityType: 'student',
      },
    },
    {
      name: 'send_welcome_notification',
      action: 'sendNotification',
      config: {
        title: 'Welcome to Infinite EduSuite',
        message: 'Your account has been successfully created',
        type: 'success',
      },
    },
    {
      name: 'notify_administration',
      action: 'sendNotification',
      config: {
        title: 'New Student Registered',
        message: 'A new student has been registered',
        type: 'info',
      },
    },
  ],
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
  failureHandling: {
    notifyOnError: true,
    deadLetterQueue: true,
  },
  isActive: true,
};

/**
 * Fee Payment Workflow
 * Triggered when a fee payment is received
 */
export const feePaymentWorkflow: WorkflowDefinition = {
  name: 'Fee Payment Processing',
  description: 'Automated workflow for fee payment processing',
  triggerEvent: 'fee.paid',
  conditions: {
    requiredPermissions: [Permission.FINANCE_VIEW],
  },
  steps: [
    {
      name: 'post_ledger_entry',
      action: 'triggerLedgerEntry',
      config: {
        transactionType: 'fee_payment',
      },
    },
    {
      name: 'create_financial_audit',
      action: 'createAuditLog',
      config: {
        action: 'fee_payment_processed',
        entityType: 'payment',
      },
    },
    {
      name: 'send_payment_confirmation',
      action: 'sendNotification',
      config: {
        title: 'Payment Received',
        message: 'Your payment has been successfully processed',
        type: 'success',
      },
    },
    {
      name: 'notify_finance_team',
      action: 'sendNotification',
      config: {
        title: 'Fee Payment Received',
        message: 'A fee payment has been received',
        type: 'info',
      },
    },
  ],
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
  failureHandling: {
    notifyOnError: true,
    deadLetterQueue: true,
  },
  isActive: true,
};

/**
 * Invoice Generation Workflow
 * Triggered when an invoice is generated
 */
export const invoiceGenerationWorkflow: WorkflowDefinition = {
  name: 'Invoice Generation',
  description: 'Automated workflow for invoice generation',
  triggerEvent: 'invoice.generated',
  conditions: {
    requiredPermissions: [Permission.FINANCE_VIEW],
  },
  steps: [
    {
      name: 'post_ledger_entry',
      action: 'triggerLedgerEntry',
      config: {
        transactionType: 'invoice_generation',
      },
    },
    {
      name: 'create_financial_audit',
      action: 'createAuditLog',
      config: {
        action: 'invoice_generated',
        entityType: 'invoice',
      },
    },
    {
      name: 'send_invoice_notification',
      action: 'sendNotification',
      config: {
        title: 'Invoice Generated',
        message: 'A new invoice has been generated for your account',
        type: 'info',
      },
    },
    {
      name: 'send_email_notification',
      action: 'sendEmail',
      config: {
        to: '{studentEmail}',
        subject: 'Invoice Generated - {invoiceId}',
        body: 'A new invoice has been generated for your account. Amount: {amount}',
      },
    },
  ],
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
  failureHandling: {
    notifyOnError: true,
    deadLetterQueue: true,
  },
  isActive: true,
};

/**
 * Exam Grading Workflow
 * Triggered when an exam is graded
 */
export const examGradingWorkflow: WorkflowDefinition = {
  name: 'Exam Grading',
  description: 'Automated workflow for exam grading',
  triggerEvent: 'exam.graded',
  conditions: {
    requiredPermissions: [Permission.EXAM_VIEW],
  },
  steps: [
    {
      name: 'create_exam_audit',
      action: 'createAuditLog',
      config: {
        action: 'exam_graded',
        entityType: 'exam',
      },
    },
    {
      name: 'send_grade_notification',
      action: 'sendNotification',
      config: {
        title: 'Exam Graded',
        message: 'Your exam has been graded. Grade: {grade}',
        type: 'info',
      },
    },
    {
      name: 'notify_parents',
      action: 'sendNotification',
      config: {
        title: 'Student Exam Grade',
        message: 'Your child has received a grade of {grade} in {examName}',
        type: 'info',
      },
    },
    {
      name: 'update_academic_records',
      action: 'callExternalWebhook',
      config: {
        url: 'https://api.example.com/academic-records',
        method: 'POST',
      },
    },
  ],
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
  failureHandling: {
    notifyOnError: true,
    deadLetterQueue: true,
  },
  isActive: true,
};

/**
 * Expense Recording Workflow
 * Triggered when an expense is recorded
 */
export const expenseRecordingWorkflow: WorkflowDefinition = {
  name: 'Expense Recording',
  description: 'Automated workflow for expense recording',
  triggerEvent: 'expense.recorded',
  conditions: {
    requiredPermissions: [Permission.FINANCE_VIEW],
  },
  steps: [
    {
      name: 'post_ledger_entry',
      action: 'triggerLedgerEntry',
      config: {
        transactionType: 'expense_recording',
      },
    },
    {
      name: 'create_financial_audit',
      action: 'createAuditLog',
      config: {
        action: 'expense_recorded',
        entityType: 'expense',
      },
    },
    {
      name: 'notify_finance_manager',
      action: 'sendNotification',
      config: {
        title: 'Expense Recorded',
        message: 'A new expense has been recorded',
        type: 'info',
      },
    },
  ],
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 1000,
  },
  failureHandling: {
    notifyOnError: true,
    deadLetterQueue: true,
  },
  isActive: true,
};

/**
 * Register all example workflows
 */
export async function registerExampleWorkflows(context: RequestContext): Promise<void> {
  await workflowEngine.registerWorkflow(studentRegistrationWorkflow, context);
  await workflowEngine.registerWorkflow(feePaymentWorkflow, context);
  await workflowEngine.registerWorkflow(invoiceGenerationWorkflow, context);
  await workflowEngine.registerWorkflow(examGradingWorkflow, context);
  await workflowEngine.registerWorkflow(expenseRecordingWorkflow, context);
}

/**
 * Workflow registration helper
 */
export async function registerWorkflow(
  workflow: WorkflowDefinition,
  context: RequestContext
): Promise<string> {
  return await workflowEngine.registerWorkflow(workflow, context);
}

/**
 * Trigger workflow helper
 */
export async function triggerWorkflow(
  workflowName: string,
  inputData: Record<string, any>,
  context: RequestContext
): Promise<string> {
  // Find workflow by name
  const { data, error } = await workflowEngine['supabase']
    .from('workflow_definitions' as any)
    .select('id')
    .eq('name', workflowName)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Workflow not found: ${workflowName}`);

  return await workflowEngine.triggerWorkflow(data.id, inputData, context);
}
