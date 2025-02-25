import { Alert, Group, SegmentedControl, Tabs, Text } from "@mantine/core";
import { memo, useEffect } from "react";
import { Opening, searchPosition } from "@/utils/db";
import {
  currentDbTabAtom,
  currentDbTypeAtom,
  currentLichessOptionsAtom,
  currentLocalOptionsAtom,
  currentMasterOptionsAtom,
  currentTabAtom,
  referenceDbAtom,
} from "@/atoms/atoms";
import { useAtom, useAtomValue } from "jotai";
import {
  convertToNormalized,
  getLichessGames,
  getMasterGames,
} from "@/utils/lichess";
import GamesTable from "./GamesTable";
import OpeningsTable from "./OpeningsTable";
import { match } from "ts-pattern";
import useSWR from "swr/immutable";
import { useDebouncedValue } from "@mantine/hooks";
import NoDatabaseWarning from "./NoDatabaseWarning";
import { formatNumber } from "@/utils/format";
import DatabaseLoader from "./DatabaseLoader";
import {
  LichessGamesOptions,
  MasterGamesOptions,
} from "@/utils/lichess/lichessexplorer";
import LichessOptionsPanel from "./options/LichessOptionsPanel";
import MasterOptionsPanel from "./options/MastersOptionsPanel";
import LocalOptionsPanel from "./options/LocalOptionsPanel";

type DBType =
  | { type: "local"; options: LocalOptions }
  | { type: "lch_all"; options: LichessGamesOptions }
  | { type: "lch_master"; options: MasterGamesOptions };

export type LocalOptions = {
  path: string | null;
  fen: string;
  type: "exact" | "partial";
};

function sortOpenings(openings: Opening[]) {
  return openings.sort(
    (a, b) => b.black + b.draw + b.white - (a.black + a.draw + a.white)
  );
}

async function fetchOpening(db: DBType, tab: string) {
  if (db.options.fen === "") return { openings: [], games: [] };
  return match(db)
    .with({ type: "lch_all" }, async ({ options }) => {
      const data = await getLichessGames(options);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(data.topGames),
      };
    })
    .with({ type: "lch_master" }, async ({ options }) => {
      const data = await getMasterGames(options);
      return {
        openings: data.moves.map((move) => ({
          move: move.san,
          white: move.white,
          black: move.black,
          draw: move.draws,
        })),
        games: await convertToNormalized(data.topGames),
      };
    })
    .with({ type: "local" }, async ({ options }) => {
      if (!options.path) throw Error("Missing reference database");
      const positionData = await searchPosition(options, tab);
      return {
        openings: sortOpenings(positionData[0]),
        games: positionData[1],
      };
    })
    .exhaustive();
}

function DatabasePanel({ height, fen }: { height: number; fen: string }) {
  const referenceDatabase = useAtomValue(referenceDbAtom);
  const [debouncedFen] = useDebouncedValue(fen, 50);
  const [lichessOptions, setLichessOptions] = useAtom(
    currentLichessOptionsAtom
  );
  const [masterOptions, setMasterOptions] = useAtom(currentMasterOptionsAtom);
  const [localOptions, setLocalOptions] = useAtom(currentLocalOptionsAtom);
  const [db, setDb] = useAtom(currentDbTypeAtom);

  useEffect(() => {
    if (db === "local") {
      setLocalOptions((q) => ({ ...q, fen: debouncedFen }));
    } else if (db === "lch_all") {
      setLichessOptions((q) => ({ ...q, fen: debouncedFen }));
    } else if (db === "lch_master") {
      setMasterOptions((q) => ({ ...q, fen: debouncedFen }));
    }
  }, [debouncedFen, setLocalOptions, setMasterOptions, setLichessOptions, db]);

  useEffect(() => {
    if (db === "local") {
      setLocalOptions((q) => ({ ...q, path: referenceDatabase }));
    }
  }, [referenceDatabase, setLocalOptions, db]);

  const dbType: DBType = match(db)
    .with("local", (v) => ({
      type: v,
      options: localOptions,
    }))
    .with("lch_all", (v) => ({ type: v, options: lichessOptions }))
    .with("lch_master", (v) => ({ type: v, options: masterOptions }))
    .exhaustive();

  const tab = useAtomValue(currentTabAtom);

  const {
    data: openingData,
    isLoading,
    error,
  } = useSWR([dbType], async ([dbType]) => {
    return fetchOpening(dbType, tab?.value || "");
  });

  const [tabType, setTabType] = useAtom(currentDbTabAtom);
  const grandTotal = openingData?.openings?.reduce(
    (acc, curr) => acc + curr.black + curr.white + curr.draw,
    0
  );

  return (
    <>
      <Group position="apart">
        <SegmentedControl
          data={[
            { label: "Local", value: "local" },
            { label: "Lichess All", value: "lch_all" },
            { label: "Lichess Masters", value: "lch_master" },
          ]}
          value={db}
          onChange={(value) =>
            setDb(value as "local" | "lch_all" | "lch_master")
          }
        />
        <Text>
          {formatNumber(
            Math.max(grandTotal || 0, openingData?.games.length || 0)
          )}{" "}
          matches
        </Text>
      </Group>

      <DatabaseLoader isLoading={isLoading} tab={tab?.value ?? null} />

      <Tabs
        defaultValue="stats"
        orientation="vertical"
        placement="right"
        value={tabType}
        onTabChange={(v) => setTabType(v!)}
      >
        <Tabs.List>
          <Tabs.Tab
            value="stats"
            disabled={
              dbType.type === "local" && dbType.options.type === "partial"
            }
          >
            Stats
          </Tabs.Tab>
          <Tabs.Tab value="games">Games</Tabs.Tab>
          <Tabs.Tab value="options">Options</Tabs.Tab>
        </Tabs.List>

        <PanelWithError value="stats" error={error} type={db}>
          <OpeningsTable
            openings={openingData?.openings || []}
            height={height}
            loading={isLoading}
          />
        </PanelWithError>
        <PanelWithError value="games" error={error} type={db}>
          <GamesTable
            games={openingData?.games || []}
            height={height}
            loading={isLoading}
          />
        </PanelWithError>
        <PanelWithError value="options" error={error} type={db}>
          {match(db)
            .with("local", () => <LocalOptionsPanel boardFen={debouncedFen} />)
            .with("lch_all", () => <LichessOptionsPanel />)
            .with("lch_master", () => <MasterOptionsPanel />)
            .exhaustive()}
        </PanelWithError>
      </Tabs>
    </>
  );
}

function PanelWithError(props: {
  value: string;
  error: string;
  type: string;
  children: React.ReactNode;
}) {
  const referenceDatabase = useAtomValue(referenceDbAtom);
  let children = props.children;
  if (props.type === "local" && !referenceDatabase) {
    children = <NoDatabaseWarning />;
  }
  if (props.error && props.type !== "local") {
    children = <Alert color="red">{props.error.toString()}</Alert>;
  }

  return (
    <Tabs.Panel pt="xs" mr="xs" value={props.value}>
      {children}
    </Tabs.Panel>
  );
}

export default memo(DatabasePanel);
