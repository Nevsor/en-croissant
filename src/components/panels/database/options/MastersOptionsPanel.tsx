import { currentMasterOptionsAtom } from "@/atoms/atoms";
import { Stack } from "@mantine/core";
import { YearPickerInput } from "@mantine/dates";
import { useAtom } from "jotai";

const MasterOptionsPanel = () => {
    const [options, setOptions] = useAtom(currentMasterOptionsAtom);
    return (
        <Stack justify="flex-start">
            <YearPickerInput label="Since"
                placeholder="Pick date"
                value={options.since ?? null}
                onChange={value => setOptions({...options, since: value ?? undefined})}
                clearable />
            <YearPickerInput label="Until"
                placeholder="Pick date"
                value={options.until ?? null}
                onChange={value => setOptions({...options, until: value ?? undefined})}
                clearable />
        </Stack>
    );
}

export default MasterOptionsPanel;