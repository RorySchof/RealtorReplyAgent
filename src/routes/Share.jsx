
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Share() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sharedText = params.get("text");

    if (sharedText) {
      localStorage.setItem("sharedText", sharedText);
    }

    navigate("/", { replace: true });
  }, [location, navigate]);

  return null;
}
