import { overrideOrder, overrideText } from "../mutation/overrides";

export interface DeviceRow {
  id: string;
  name: string;
  owner: string;
  status: "online" | "offline";
  lastSeen: string;
}

export interface EditingState {
  id: string;
  draft: string;
}

interface DeviceTableProps {
  heading: string;
  headingTestId: string;
  cardClassName: string;
  tableClassName: string;
  tableTestId: string;
  rowTestId: string;
  sortButtonTestId: string;
  editActionTestId: string;
  removeActionTestId: string;
  /** Distinguishes the Active/Archived instance for row-order mutation keys. */
  mutationScope: "active" | "archived";
  rows: readonly DeviceRow[];
  editing: EditingState | null;
  onSort: () => void;
  onStartEdit: (row: DeviceRow) => void;
  onDraftChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: (id: string) => void;
}

export function DeviceTable({
  heading,
  headingTestId,
  cardClassName,
  tableClassName,
  tableTestId,
  rowTestId,
  sortButtonTestId,
  editActionTestId,
  removeActionTestId,
  mutationScope,
  rows,
  editing,
  onSort,
  onStartEdit,
  onDraftChange,
  onSaveEdit,
  onCancelEdit,
  onRemove,
}: DeviceTableProps) {
  // sibling-reorder's real target: a position-anchored probe (see
  // packages/benchmark/src/targets.ts) — attribute/role-based selectors
  // don't care about row order at all, so this is the one class that needs
  // an explicit index-based frozen selector to demonstrate against.
  const orderedRows = overrideOrder(`devices.${mutationScope}.rowOrder`, rows);

  return (
    <section className={cardClassName}>
      <h2 data-testid={headingTestId}>{heading}</h2>
      <table className={tableClassName} data-testid={tableTestId}>
        <thead>
          <tr>
            <th>
              <button type="button" data-testid={sortButtonTestId} onClick={onSort}>
                Device Name
              </button>
            </th>
            <th>Owner</th>
            <th>Status</th>
            <th>Last Seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orderedRows.map((row) => {
            const isEditing = editing?.id === row.id;
            const editText = overrideText(`devices.row.${row.id}.editText`, "Edit");
            const removeText = overrideText(`devices.row.${row.id}.removeText`, "Remove");
            const saveText = overrideText(`devices.row.${row.id}.saveText`, "Save");
            const cancelText = overrideText(`devices.row.${row.id}.cancelText`, "Cancel");
            const editButton = (
              <button
                key="edit"
                type="button"
                data-testid={editActionTestId}
                onClick={() => onStartEdit(row)}
              >
                {editText}
              </button>
            );
            const removeButton = (
              <button
                key="remove"
                type="button"
                data-testid={removeActionTestId}
                onClick={() => onRemove(row.id)}
              >
                {removeText}
              </button>
            );
            const orderedActions = overrideOrder(`devices.row.${row.id}.actionsOrder`, [
              editButton,
              removeButton,
            ]);

            return (
              <tr key={row.id} data-testid={rowTestId}>
                <td>
                  {isEditing ? (
                    <input
                      value={editing.draft}
                      onChange={(event) => onDraftChange(event.target.value)}
                      aria-label={`Edit name for ${row.name}`}
                    />
                  ) : (
                    row.name
                  )}
                </td>
                <td>{row.owner}</td>
                <td>{row.status}</td>
                <td>{row.lastSeen}</td>
                <td>
                  {isEditing ? (
                    <>
                      <button type="button" onClick={onSaveEdit}>
                        {saveText}
                      </button>
                      <button type="button" onClick={onCancelEdit}>
                        {cancelText}
                      </button>
                    </>
                  ) : (
                    orderedActions
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
