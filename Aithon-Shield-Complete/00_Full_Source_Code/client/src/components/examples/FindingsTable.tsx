import { FindingsTable } from "../FindingsTable";

export default function FindingsTableExample() {
  return (
    <div className="p-4 bg-background">
      <FindingsTable findings={[]} isLoading={false} />
    </div>
  );
}
