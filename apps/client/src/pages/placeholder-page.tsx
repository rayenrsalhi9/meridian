interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({
  title,
  description = "This page is under construction.",
}: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  );
}
