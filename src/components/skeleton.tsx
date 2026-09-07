import { Content, Header, TabBar } from "@/components/chrome";
import { NavBar } from "@/components/nav-bar";

/**
 * What a screen shows while its data is in flight.
 *
 * Without one of these, tapping a tab left the previous screen on the glass,
 * frozen, until the server came back — which reads as a dead app rather than
 * a loading one. These render instantly from the client, so a tap always
 * does something.
 *
 * The shapes mirror the real screen's layout so the swap does not jump.
 */
export function ScreenSkeleton({
  title,
  rows = 6,
  segmented = false,
}: {
  title: string;
  rows?: number;
  segmented?: boolean;
}) {
  return (
    <>
      <Header title={title} />
      {segmented ? (
        <div className="shrink-0 px-4 pb-3">
          <div className="shimmer segmented h-8 rounded-[9px]" />
        </div>
      ) : null}
      <Content>
        <SkeletonGroup rows={rows} />
      </Content>
      <TabBar />
    </>
  );
}

/** The pushed-screen variant: a nav bar rather than a large title. */
export function PushedSkeleton({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <>
      <NavBar title={title} backLabel="Back" />
      <Content className="pt-4">
        <SkeletonGroup rows={rows} />
      </Content>
      <TabBar />
    </>
  );
}

function SkeletonGroup({ rows }: { rows: number }) {
  return (
    <div className="ios-group mb-6">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="ios-row" style={{ height: 52 }}>
          <div className="flex-1">
            {/* Vary the widths so it reads as text, not as a loading bar. */}
            <div
              className="shimmer h-[15px] rounded-[4px]"
              style={{ width: `${[62, 78, 45, 70, 55, 84, 50, 66][index % 8]}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
