import { Button } from "@/components/ui/button"

const App = () => {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Meridian
        </h1>
        <p className="text-muted-foreground max-w-md text-base sm:text-lg">
          Enterprise intranet platform — documents, chat, and forums in one place.
        </p>
        <Button size="lg">Get started</Button>
      </div>
    </main>
  )
}

export default App
