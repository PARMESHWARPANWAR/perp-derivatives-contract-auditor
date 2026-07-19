import AuditWorkspace from "../components/AuditWorkspace";

export const dynamic = "force-dynamic";

export default function Home() {
  return <AuditWorkspace mockMode={process.env.MOCK_MODE === "true"} />;
}
