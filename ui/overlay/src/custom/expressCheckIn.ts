// What the two-page check-in needs before it lets the desk go on.

export interface CheckInForm {
  name: string
  /** The guest's profile already holds an ID. */
  idOnFile: boolean
  idType: string
  idNumber: string
  /** The booking already has a room. */
  hasRoom: boolean
  pickedRoom: string
  /** Signed on screen, on the printed card, or earlier. */
  signed: boolean
  /** Other guests whose ID is still missing (the law asks every adult). Empty when none. */
  othersMissing?: string[]
}

export interface Problem {
  page: 1 | 2
  message: string
}

/** Name, ID, room and signature: the four things asked. Empty when all are there. */
export function checkInProblems(f: CheckInForm): Problem[] {
  const out: Problem[] = []
  if (!f.name.trim()) out.push({ page: 1, message: "The guest has no name." })
  const idTyped = f.idType.trim() !== "" && f.idNumber.trim() !== ""
  if (!f.idOnFile && !idTyped) out.push({ page: 1, message: "Choose the ID type and type the ID number." })
  if (!f.hasRoom && !f.pickedRoom) out.push({ page: 1, message: "Choose a room." })
  if (f.othersMissing?.length) out.push({ page: 1, message: `ID still needed for: ${f.othersMissing.join(", ")}.` })
  if (!f.signed) out.push({ page: 2, message: "The guest must sign." })
  return out
}

const CLEAN = new Set(["Clean", "Inspected", "Ready"])
export const isCleanRoom = (status: string | null | undefined) => CLEAN.has(status ?? "")

/** The room to pre-select: the first clean one, else the first free one (unless only clean rooms may be used). */
export function defaultRoom(rooms: { name: string; housekeeping_status: string }[], cleanOnly: boolean): string {
  const clean = rooms.find((r) => isCleanRoom(r.housekeeping_status))
  if (clean) return clean.name
  return cleanOnly ? "" : (rooms[0]?.name ?? "")
}
