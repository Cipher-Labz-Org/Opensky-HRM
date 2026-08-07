"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AttendanceQrPanel, type AttendanceQrKind } from "@/components/settings/AttendanceQrPanel";

type AttendanceQrModalProps = {
  open: boolean;
  onClose: () => void;
  kind: AttendanceQrKind;
  entityId: string | null;
  entityName?: string;
  entityCode?: string;
};

export function AttendanceQrModal({
  open,
  onClose,
  kind,
  entityId,
  entityName,
  entityCode,
}: AttendanceQrModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Attendance QR">
      <AttendanceQrPanel
        kind={kind}
        entityId={entityId}
        entityName={entityName}
        entityCode={entityCode}
      />
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

/** @deprecated Use AttendanceQrModal */
export function BusinessUnitAttendanceQrModal({
  open,
  onClose,
  businessUnitId,
  businessUnitName,
  businessUnitCode,
}: {
  open: boolean;
  onClose: () => void;
  businessUnitId: string | null;
  businessUnitName?: string;
  businessUnitCode?: string;
}) {
  return (
    <AttendanceQrModal
      open={open}
      onClose={onClose}
      kind="businessUnit"
      entityId={businessUnitId}
      entityName={businessUnitName}
      entityCode={businessUnitCode}
    />
  );
}
