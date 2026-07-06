import { useMemo, useState } from "react";
import { domProfile } from "../domProfile";
import { DeviceTable, type DeviceRow, type EditingState } from "../components/DeviceTable";

type TableKey = "active" | "archived";
type SortDirection = "none" | "asc" | "desc";

const initialActiveDevices: DeviceRow[] = [
  {
    id: "dev-1",
    name: "Front Desk Tablet",
    owner: "A. Ramirez",
    status: "online",
    lastSeen: "2026-07-05 08:12",
  },
  {
    id: "dev-2",
    name: "Warehouse Scanner",
    owner: "K. Nguyen",
    status: "online",
    lastSeen: "2026-07-05 07:58",
  },
  {
    id: "dev-3",
    name: "Conference Room Display",
    owner: "S. Patel",
    status: "offline",
    lastSeen: "2026-07-04 22:10",
  },
  {
    id: "dev-4",
    name: "Loading Dock Printer",
    owner: "M. Alvarez",
    status: "online",
    lastSeen: "2026-07-05 06:40",
  },
  {
    id: "dev-5",
    name: "Reception Kiosk",
    owner: "T. Chen",
    status: "online",
    lastSeen: "2026-07-05 08:00",
  },
];

const initialArchivedDevices: DeviceRow[] = [
  {
    id: "dev-9",
    name: "Front Desk Tablet",
    owner: "A. Ramirez",
    status: "offline",
    lastSeen: "2026-05-11 10:00",
  },
  {
    id: "dev-10",
    name: "Legacy Barcode Scanner",
    owner: "K. Nguyen",
    status: "offline",
    lastSeen: "2026-01-20 09:15",
  },
  {
    id: "dev-11",
    name: "Old Conference Display",
    owner: "S. Patel",
    status: "offline",
    lastSeen: "2025-11-02 14:30",
  },
  {
    id: "dev-12",
    name: "Retired Dock Printer",
    owner: "M. Alvarez",
    status: "offline",
    lastSeen: "2025-09-18 11:05",
  },
  {
    id: "dev-13",
    name: "Decommissioned Kiosk",
    owner: "T. Chen",
    status: "offline",
    lastSeen: "2025-08-01 09:45",
  },
];

function sortRows(rows: readonly DeviceRow[], direction: SortDirection): DeviceRow[] {
  if (direction === "none") return [...rows];
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  return direction === "asc" ? sorted : sorted.reverse();
}

export function DevicesPage() {
  const [tables, setTables] = useState<Record<TableKey, DeviceRow[]>>({
    active: initialActiveDevices,
    archived: initialArchivedDevices,
  });
  const [sortDir, setSortDir] = useState<Record<TableKey, SortDirection>>({
    active: "none",
    archived: "none",
  });
  const [editing, setEditing] = useState<{ table: TableKey; id: string; draft: string } | null>(
    null,
  );

  const activeRows = useMemo(
    () => sortRows(tables.active, sortDir.active),
    [tables.active, sortDir.active],
  );
  const archivedRows = useMemo(
    () => sortRows(tables.archived, sortDir.archived),
    [tables.archived, sortDir.archived],
  );

  function handleSort(table: TableKey) {
    setSortDir((prev) => ({ ...prev, [table]: prev[table] === "asc" ? "desc" : "asc" }));
  }

  function handleStartEdit(table: TableKey, row: DeviceRow) {
    setEditing({ table, id: row.id, draft: row.name });
  }

  function handleDraftChange(value: string) {
    setEditing((prev) => (prev ? { ...prev, draft: value } : prev));
  }

  function handleCancelEdit() {
    setEditing(null);
  }

  function handleSaveEdit() {
    if (!editing) return;
    const { table, id, draft } = editing;
    setTables((prev) => ({
      ...prev,
      [table]: prev[table].map((row) => (row.id === id ? { ...row, name: draft } : row)),
    }));
    setEditing(null);
  }

  function handleRemove(table: TableKey, id: string) {
    setTables((prev) => ({ ...prev, [table]: prev[table].filter((row) => row.id !== id) }));
  }

  function editingStateFor(table: TableKey): EditingState | null {
    if (!editing || editing.table !== table) return null;
    return { id: editing.id, draft: editing.draft };
  }

  return (
    <div className="devices-page">
      <DeviceTable
        heading="Active Devices"
        headingTestId={domProfile.devices.active.heading}
        cardClassName={domProfile.devices.active.card}
        tableClassName={domProfile.devices.active.table}
        tableTestId={domProfile.devices.active.testId}
        rowTestId={domProfile.devices.active.row}
        sortButtonTestId={domProfile.devices.nameHeaderButton}
        editActionTestId={domProfile.devices.editAction}
        removeActionTestId={domProfile.devices.removeAction}
        rows={activeRows}
        editing={editingStateFor("active")}
        onSort={() => handleSort("active")}
        onStartEdit={(row) => handleStartEdit("active", row)}
        onDraftChange={handleDraftChange}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onRemove={(id) => handleRemove("active", id)}
      />
      <DeviceTable
        heading="Archived Devices"
        headingTestId={domProfile.devices.archived.heading}
        cardClassName={domProfile.devices.archived.card}
        tableClassName={domProfile.devices.archived.table}
        tableTestId={domProfile.devices.archived.testId}
        rowTestId={domProfile.devices.archived.row}
        sortButtonTestId={domProfile.devices.nameHeaderButton}
        editActionTestId={domProfile.devices.editAction}
        removeActionTestId={domProfile.devices.removeAction}
        rows={archivedRows}
        editing={editingStateFor("archived")}
        onSort={() => handleSort("archived")}
        onStartEdit={(row) => handleStartEdit("archived", row)}
        onDraftChange={handleDraftChange}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onRemove={(id) => handleRemove("archived", id)}
      />
    </div>
  );
}
