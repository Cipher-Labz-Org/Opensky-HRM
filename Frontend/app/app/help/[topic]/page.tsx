import { notFound } from "next/navigation";
import { getHelpTopic } from "@/lib/help-topics";
import { HelpTopicView } from "@/components/help/HelpTopicView";

export default function HelpTopicPage({ params }: { params: { topic: string } }) {
  const topic = getHelpTopic(params.topic);
  if (!topic) notFound();
  return <HelpTopicView topic={topic} />;
}
