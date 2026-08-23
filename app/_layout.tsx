import { Stack } from "expo-router";
import { useEffect } from "react";
import { iniciarBanco } from "../src/db/schema";

export default function RootLayout() {
  useEffect(() => {
    iniciarBanco();
  }, []);

  return <Stack />;
}