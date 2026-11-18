const names=['ArrowLeft','BookOpen','Briefcase','CaretRight','ChatCircleText','ClipboardText','Files','Gear','GitBranch','Heartbeat','List','Notebook','Users','X']
export const suiteIcons=Object.fromEntries(await Promise.all(names.map(async name=>[name,(await import(`@phosphor-icons/react/dist/csr/${name}`))[name]])))
