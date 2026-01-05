import SiteEditorClient from "./SiteEditorClient";

export const dynamic = "force-dynamic";

export default function SiteEditorPage({ params }: { params: { id: string } }) {
  return <SiteEditorClient id={params.id} />;
}
