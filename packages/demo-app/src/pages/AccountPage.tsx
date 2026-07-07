import { useState, type ReactNode } from "react";
import { domProfile } from "../domProfile";
import { Modal } from "../components/Modal";
import { isWrapped, overrideTag, overrideText } from "../mutation/overrides";

function wrapIfMutated(mutationKey: string, node: ReactNode): ReactNode {
  return isWrapped(mutationKey) ? <div>{node}</div> : node;
}

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

  const openDeleteText = overrideText("account.openDeleteButton.text", "Delete Account");
  const openDeleteTag = overrideTag("account.openDeleteButton.tag", "button");
  const openDeleteButton =
    openDeleteTag === "a" ? (
      <a
        href="#delete-account"
        data-testid={domProfile.account.openDeleteButton}
        onClick={() => setDialogOpen(true)}
      >
        {openDeleteText}
      </a>
    ) : (
      <button
        type="button"
        data-testid={domProfile.account.openDeleteButton}
        onClick={() => setDialogOpen(true)}
      >
        {openDeleteText}
      </button>
    );

  const cancelText = overrideText("account.cancelButton.text", "Cancel");
  const confirmText = overrideText("account.confirmButton.text", "Confirm Delete");
  const confirmTag = overrideTag("account.confirmButton.tag", "button");
  const confirmButton =
    confirmTag === "a" ? (
      <a href="#confirm-delete" data-testid={domProfile.account.confirmButton} onClick={handleConfirm}>
        {confirmText}
      </a>
    ) : (
      <button type="button" data-testid={domProfile.account.confirmButton} onClick={handleConfirm}>
        {confirmText}
      </button>
    );

  return (
    <div className="account-page">
      <h2>Account</h2>
      <p>Manage your Ward account. Deleting your account removes dashboard access.</p>
      {wrapIfMutated("account.openDeleteButton", openDeleteButton)}

      {dialogOpen && (
        <Modal
          testId={domProfile.account.dialog}
          titleId="delete-account-title"
          title="Delete Account?"
        >
          <p>This action cannot be undone.</p>
          {wrapIfMutated(
            "account.cancelButton",
            <button
              type="button"
              data-testid={domProfile.account.cancelButton}
              onClick={() => setDialogOpen(false)}
            >
              {cancelText}
            </button>,
          )}
          {wrapIfMutated("account.confirmButton", confirmButton)}
        </Modal>
      )}
    </div>
  );
}
