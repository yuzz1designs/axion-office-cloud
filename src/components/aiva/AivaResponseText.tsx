export default function AivaResponseText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  return <>{parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    return link ? <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-white">{link[1]}</a> : <span key={index}>{part}</span>;
  })}</>;
}
