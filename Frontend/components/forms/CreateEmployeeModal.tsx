"use client";

import { Modal } from "@/components/ui/Modal";
import { EmployeeForm, type EmployeeFormInitialValues } from "@/components/employees/EmployeeForm";

export type { EmployeeFormInitialValues };

interface CreateEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** When set, submits to recruitment hire endpoint after validating the employee form. */
  candidateId?: string;
  initialValues?: EmployeeFormInitialValues;
  title?: string;
  submitLabel?: string;
  onConverted?: (result: { employeeId: string; onboardingStarted?: boolean }) => void;
}

export function CreateEmployeeModal({
  open,
  onClose,
  onCreated,
  candidateId,
  initialValues,
  title = "Create New Employee",
  submitLabel = "Create Employee",
  onConverted,
}: CreateEmployeeModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {open ? (
        <EmployeeForm
          key={candidateId ?? "new"}
          mode="create"
          layout="modal"
          candidateId={candidateId}
          initialValues={initialValues}
          submitLabel={submitLabel}
          onCancel={onClose}
          onSaved={(result) => {
            if (candidateId) {
              onConverted?.({ employeeId: result.employeeId, onboardingStarted: result.onboardingStarted });
            } else {
              onCreated?.();
            }
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}
