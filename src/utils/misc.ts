import { BaseDirectory, readTextFile, writeTextFile } from "@tauri-apps/api/fs";
import React, { useEffect, useRef, useState } from "react";

type StorageValue<T> = [T, React.Dispatch<React.SetStateAction<T>>];

export function useLocalFile<T>(
    filename: string,
    defaultValue: T
): StorageValue<T> {
    const [state, setState] = useState<T>(defaultValue);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        readTextFile(filename, {
            dir: BaseDirectory.AppData,
        }).then((text) => {
            setLoaded(true);
            if (text === "") {
                return;
            }
            const data = JSON.parse(text);
            setState(data);
        });
    }, [filename]);

    useEffect(() => {
        if (loaded) {
            writeTextFile(filename, JSON.stringify(state), {
                dir: BaseDirectory.AppData,
            });
        }
    }, [filename, state, loaded]);

    return [state, setState];
}

export function getBoardSize(height: number, width: number) {
    const initial = Math.min((height - 140) * 0.95, width * 0.4);
    if (width < 680) {
        return width - 120;
    }
    return initial;
}

export function isPrefix<T>(shorter: T[], longer: T[]): boolean {
    if (shorter.length > longer.length) {
        return false;
    }
    for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] !== longer[i]) {
            return false;
        }
    }
    return true;
}

export const useThrottledEffect = (
    callback: () => void,
    delay: number,
    deps: React.DependencyList
) => {
    const lastRan = useRef(Date.now());

    useEffect(() => {
        const handler = setTimeout(function () {
            if (Date.now() - lastRan.current >= delay) {
                callback();
                lastRan.current = Date.now();
            }
        }, delay - (Date.now() - lastRan.current));

        return () => {
            clearTimeout(handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [delay, ...deps]);
};

export function mean(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function harmonicMean(arr: number[]): number {
    const sum = arr.reduce((a, b) => a + 1 / b, 0);
    return arr.length / sum;
}
