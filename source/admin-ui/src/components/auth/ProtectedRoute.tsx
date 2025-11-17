import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchAuthSession } from "aws-amplify/auth";
import { useEffect, useState } from "react";
import { Spinner } from "@cloudscape-design/components";

export default function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await fetchAuthSession();
        const hasTokens = !!session.tokens?.accessToken;
        if (!cancelled) {
          setAuthed(hasTokens);
        }
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.key]); // re-check on navigation, including back/forward

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spinner size="large" />
      </div>
    );
  }
  
  if (!authed) {
    return <Navigate to="/auth/logout-complete" replace />;
  }
  
  return <Outlet />;
}
