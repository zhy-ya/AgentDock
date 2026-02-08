import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";

const customStyles = {
  variables: {
    light: {
      diffViewerBackground: "transparent",
      addedBackground: "#dcfce7",
      addedColor: "#166534",
      removedBackground: "#fee2e2",
      removedColor: "#991b1b",
      wordAddedBackground: "#bbf7d0",
      wordRemovedBackground: "#fecaca",
      addedGutterBackground: "#dcfce7",
      removedGutterBackground: "#fee2e2",
      gutterBackground: "transparent",
      gutterBackgroundDark: "transparent",
      codeFoldBackground: "#f3f4f6",
      codeFoldGutterBackground: "#f3f4f6",
      emptyLineBackground: "transparent",
    },
  },
  line: {
    padding: "2px 10px",
    fontSize: "12px",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  contentText: {
    fontSize: "12px",
    lineHeight: "1.6",
  },
};

export function DiffViewer({
  oldValue,
  newValue,
  splitView = true,
}: {
  oldValue: string;
  newValue: string;
  splitView?: boolean;
}) {
  return (
    <ReactDiffViewer
      oldValue={oldValue}
      newValue={newValue}
      splitView={splitView}
      compareMethod={DiffMethod.WORDS}
      showDiffOnly={true}
      useDarkTheme={false}
      styles={customStyles}
      leftTitle="变更前"
      rightTitle="变更后"
    />
  );
}
