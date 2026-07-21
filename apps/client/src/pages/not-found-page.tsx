import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="font-heading text-4xl font-bold">
        <span aria-hidden="true">404</span>
        <span className="sr-only">Page not found</span>
      </h1>
      <p className="text-muted-foreground" aria-hidden="true">
        Page not found
      </p>
      <Button variant="outline" render={<Link to="/" />}>
        <HomeIcon className="size-4" />
        Go home
      </Button>
    </div>
  );
}
