import { TriangleAlert } from "lucide-react";
import PhamViXepPanel from "./PhamViXepPanel";
import WorkflowStrip from "./WorkflowStrip";
import { Notice } from "@/components/shared/notice";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SchedulingWorkflowDialog({
  open,
  onOpenChange,
  data,
  phamVi,
  onPhamViChange,
  ketQuaPhamVi,
  steps,
  canEdit,
  loading,
  error,
  problemInbox,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="schedule-workflow-glass top-[46%] flex h-[min(600px,calc(100dvh-2rem))] w-[min(1000px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-5 py-3 pr-12">
          <DialogTitle className="text-xl">Quy trình xếp lịch</DialogTitle>
          <DialogDescription>
            Chọn phạm vi rồi chủ động chạy từng bước. Mở cửa sổ này không tự chạy solver và không tự lưu lịch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3 overflow-y-auto p-3 min-[720px]:grid-cols-[minmax(0,2.25fr)_minmax(230px,0.75fr)] min-[720px]:items-stretch">
          <div className="min-w-0 space-y-3">
            <PhamViXepPanel
              data={data}
              phamVi={phamVi}
              onChange={onPhamViChange}
              disabled={loading || !canEdit}
              ketQuaPhamVi={ketQuaPhamVi}
            />
            {error && (
              <Notice tone="red" icon={TriangleAlert} className="font-bold text-black">
                {error}
              </Notice>
            )}
            <WorkflowStrip steps={steps} canEdit={canEdit} loading={loading} />
          </div>
          <div className="schedule-workflow-inbox min-w-0 self-stretch">
            {problemInbox}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
