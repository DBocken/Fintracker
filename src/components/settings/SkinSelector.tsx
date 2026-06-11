import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette } from "lucide-react";
import { SKINS, type SkinId } from "@/skins/skins";

type Props = {
  value: SkinId;
  onChange: (skin: SkinId) => void;
};

export function SkinSelector({ value, onChange }: Props) {
  return (
    <Card className="bg-background/60 backdrop-blur">
      <CardHeader className="flex flex-row items-center gap-3">
        <Palette className="h-5 w-5 text-primary" />
        <div>
          <CardTitle className="text-base">Skin & Theme</CardTitle>
          <CardDescription>Wähle den Look deines Dashboards</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Label htmlFor="skin">Skin auswählen</Label>
          <Select value={value} onValueChange={(v) => onChange(v as SkinId)}>
            <SelectTrigger id="skin" className="w-full">
              <SelectValue placeholder="Skin wählen" />
            </SelectTrigger>
            <SelectContent>
              {SKINS.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

export default SkinSelector;