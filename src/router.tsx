import { Navigate, Route, Routes } from "react-router-dom";
import { frameRouteRegistry } from "./routes/route-registry";
import { RouteContextProvider } from "./routes/route-context";
import { RouteWorkspaceAdapter, type RouteWorkspaceAdapterProps } from "./routes/route-workspace-adapter";

type AppRouteOutletProps = RouteWorkspaceAdapterProps & {
  rootPath: string | null;
};

function RegisteredFrameRoute(props: RouteWorkspaceAdapterProps) {
  return (
    <RouteContextProvider>
      <RouteWorkspaceAdapter {...props} />
    </RouteContextProvider>
  );
}

function RouteNotFound() {
  return (
    <section className="route-not-found" data-ui-state="error">
      <p className="eyebrow">404 / ROUTE NOT FOUND</p>
      <h1>找不到这个页面</h1>
      <p>当前地址没有对应的 SVG Frame 路由，请从侧栏选择一个工作区。</p>
    </section>
  );
}

export function AppRouteOutlet({ rootPath, ...adapterProps }: AppRouteOutletProps) {
  return (
    <Routes>
      <Route
        path="/"
        element={rootPath
          ? <Navigate replace to={rootPath} />
          : <section className="route-root-loading" data-ui-state="loading">Loading persisted workspace…</section>}
      />
      {frameRouteRegistry.map((record) => (
        <Route element={<RegisteredFrameRoute {...adapterProps} />} key={record.svgRoute} path={record.svgRoute} />
      ))}
      <Route element={<RouteNotFound />} path="*" />
    </Routes>
  );
}
