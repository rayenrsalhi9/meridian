import { Outlet } from "react-router";
import { AppShell } from "@/components/app-shell";

const App = () => {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

export default App;
