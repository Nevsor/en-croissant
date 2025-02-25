import { Engine } from "@/utils/engines";
import { TextInput, NumberInput, Input, Button, Text } from "@mantine/core";
import { UseFormReturnType } from "@mantine/form";
import { invoke } from "@tauri-apps/api";
import FileInput from "../common/FileInput";
import { open } from "@tauri-apps/api/dialog";
import useSWR from "swr";
import { platform } from "@tauri-apps/api/os";
import { match } from "ts-pattern";

export default function EngineForm({
  onSubmit,
  form,
  submitLabel,
}: {
  onSubmit: (values: Engine) => void;
  form: UseFormReturnType<Engine, (values: Engine) => Engine>;
  submitLabel: string;
}) {
  const { data: os } = useSWR("os", async () => {
    const p = await platform();
    const os = match(p)
      .with("win32", () => "windows" as const)
      .with("linux", () => "linux" as const)
      .with("darwin", () => "macos" as const)
      .otherwise(() => {
        throw Error("OS not supported");
      });
    return os;
  });

  const filters = match(os)
    .with("windows", () => [{ name: "Executable Files", extensions: ["exe"] }])
    .otherwise(() => []);

  return (
    <form onSubmit={form.onSubmit(async (values) => onSubmit(values))}>
      <FileInput
        label="Binary file"
        description="Click to select the binary file"
        filename={form.values.path}
        withAsterisk
        onClick={async () => {
          const selected = await open({
            multiple: false,
            filters,
          });
          if (!selected) return;
          const name: string = await invoke("get_engine_name", {
            path: selected as string,
          });
          form.setFieldValue("path", selected as string);
          form.setFieldValue("name", name);
        }}
      />

      <TextInput
        label="Name"
        placeholder="Auto"
        withAsterisk
        {...form.getInputProps("name")}
      />

      <NumberInput
        label="Elo"
        placeholder="Engine's Elo"
        {...form.getInputProps("elo")}
      />

      <Input.Wrapper
        label="Image file"
        description="Click to select the image file (recommended size: 60x60)"
        {...form.getInputProps("image")}
      >
        <Input
          component="button"
          type="button"
          // accept="application/octet-stream"
          onClick={async () => {
            const selected = await open({
              multiple: false,
              filters: [
                {
                  name: "Image",
                  extensions: ["png", "jpeg"],
                },
              ],
            });
            form.setFieldValue("image", selected as string);
          }}
        >
          <Text lineClamp={1}>{form.values.image}</Text>
        </Input>
      </Input.Wrapper>

      <Button fullWidth mt="xl" type="submit">
        {submitLabel}
      </Button>
    </form>
  );
}
