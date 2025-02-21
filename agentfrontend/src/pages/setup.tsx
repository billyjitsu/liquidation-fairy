import BorrowCard from "@/components/borrow-card";
import DelegateCard from "@/components/delegate-card";
import DeployCard from "@/components/deploy-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  {
    id: "deploy",
    title: "Deploy Multisig",
    content: DeployCard,
  },
  {
    id: "delegate",
    title: "Delegate Access",
    content: DelegateCard,
  },
  {
    id: "borrow",
    title: "Delegate Borrowing",
    content: BorrowCard,
  },
];

export default function SetupPage() {
  return (
    <div className="flex justify-center mt-[50px] h-full">
      <Tabs defaultValue={TABS[0].id} className="w-full max-w-2xl">
        <TabsList className="w-full justify-between">
          {TABS.map((tab, index) => (
            <TabsTrigger className="w-1/3" value={tab.id}>
              <div className="flex items-center gap-2">
                <div className="text-xs">{index + 1}</div>
                <div className="text-sm font-medium">{tab.title}</div>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent value={tab.id}>
            <tab.content />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
