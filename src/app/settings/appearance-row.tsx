"use client";

import { Group, Row, Segmented } from "@/components/ui";
import { useTheme } from "@/components/theme";

/** Light or dark, applied immediately and persisted in the background. */
export function AppearanceRow({ initialTheme }: { initialTheme: "dark" | "light" }) {
  const { theme, setTheme } = useTheme();
  const current = theme ?? initialTheme;

  return (
    <Group>
      <Row>
        <span className="t-body flex-1">Appearance</span>
        <Segmented
          ariaLabel="Appearance"
          className="w-[150px]"
          value={current}
          options={[
            { value: "light" as const, label: "Light" },
            { value: "dark" as const, label: "Dark" },
          ]}
          onChange={setTheme}
        />
      </Row>
    </Group>
  );
}
