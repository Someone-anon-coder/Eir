import { useState } from "react";
import { domProfile } from "../domProfile";
import { Modal } from "../components/Modal";

export function AccountPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  function handleConfirm() {
    setDeleted(true);
    setDialogOpen(false);
  }

  if (deleted) {
    return (
      <div className="account-page">
        <p data-testid={domProfile.account.deletedBanner}>Account deleted.</p>
      </div>
    );
  }

  return (
    <div className="account-page">
      <h2>Account</h2>
      <p>Manage your Ward account. Deleting your account removes dashboard access.</p>
      <button
        type="button"
        data-testid={domProfile.account.openDeleteButton}
        onClick={() => setDialogOpen(true)}
      >
        Delete Account
      </button>

      {dialogOpen && (
        <Modal testId={domProfile.account.dialog} titleId="delete-account-title" title="Delete Account?">
          <p>This action cannot be undone.</p>
          <button
            type="button"
            data-testid={domProfile.account.cancelButton}
            onClick={() => setDialogOpen(false)}
          >
            Cancel
          </button>
          <button type="button" data-testid={domProfile.account.confirmButton} onClick={handleConfirm}>
            Confirm Delete
          </button>
        </Modal>
      )}
    </div>
  );
}
