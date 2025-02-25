import { Slider } from "@mantine/core";
import { useEffect, useState } from "react";

export default function CoresSlide({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  const [tempValue, setTempValue] = useState(Math.log2(value));
  const MARKS = [
    { value: 0 },
    { value: 1 },
    { value: 2 },
    { value: 3 },
    { value: 4 },
    { value: 5 },
    { value: 6 },
  ];

  useEffect(() => {
    setTempValue(Math.log2(value));
  }, [value]);

  return (
    <>
      <Slider
        min={0}
        max={Math.log2(navigator.hardwareConcurrency)}
        value={tempValue}
        onChange={setTempValue}
        onChangeEnd={(v) => setValue(2 ** v)}
        marks={MARKS}
        label={(value) => 2 ** value}
      />
    </>
  );
}
