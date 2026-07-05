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
  rows,
  editing,
  onSort,
  onStartEdit,
  onDraftChange,
  onSaveEdit,
  onCancelEdit,
  onRemove,
}: DeviceTableProps) {
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
          {rows.map((row) => {
            const isEditing = editing?.id === row.id;
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
                        Save
                      </button>
                      <button type="button" onClick={onCancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid={editActionTestId}
                        onClick={() => onStartEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-testid={removeActionTestId}
                        onClick={() => onRemove(row.id)}
                      >
                        Remove
                      </button>
                    </>
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
