from __future__ import annotations

import argparse
import json

from pebr_stats.overlap import summarize_overlaps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", default="data/polls.json")
    parser.add_argument("--output", default="overlap-report.json")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as handle:
        rows = json.load(handle)

    report = summarize_overlaps(rows)
    report["records"] = len(rows)

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
