import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, UserPlus, Plus } from 'lucide-react';
import {
  getHouseholds,
  getHouseholdMembers,
  upsertHousehold,
  upsertHouseholdMember,
  deleteHouseholdMember,
  deleteHousehold,
} from '@/services/household-service';

/**
 * Minimaler Haushalts-Slice: ein Haushalt anlegen, Mitglieder verwalten. Validiert
 * das lokale Datenmodell end-to-end. Geteilte Ausgaben pro Transaktion folgen als
 * nächster Schritt. Alles strikt lokal.
 */
export function HouseholdSettings() {
  const qc = useQueryClient();
  const [householdName, setHouseholdName] = useState('');
  const [memberName, setMemberName] = useState('');

  const { data: households = [] } = useQuery({ queryKey: ['households'], queryFn: getHouseholds });
  const household = households[0] ?? null;

  const { data: members = [] } = useQuery({
    queryKey: ['household-members', household?.id],
    queryFn: () => getHouseholdMembers(household?.id),
    enabled: !!household,
  });

  const createHousehold = useMutation({
    mutationFn: (name: string) => upsertHousehold({ name }),
    onSuccess: () => {
      setHouseholdName('');
      qc.invalidateQueries({ queryKey: ['households'] });
    },
  });

  const addMember = useMutation({
    mutationFn: (name: string) => upsertHouseholdMember({ household_id: household!.id, name }),
    onSuccess: () => {
      setMemberName('');
      qc.invalidateQueries({ queryKey: ['household-members', household?.id] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (id: string) => deleteHouseholdMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['household-members', household?.id] }),
  });

  const removeHousehold = useMutation({
    mutationFn: (id: string) => deleteHousehold(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['households'] });
      qc.invalidateQueries({ queryKey: ['household-members'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Haushalt</CardTitle>
        <CardDescription>
          Lege einen Haushalt an und verwalte Mitglieder für geteilte Ausgaben. Alles bleibt lokal auf deinem Gerät.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!household ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (householdName.trim()) createHousehold.mutate(householdName.trim());
            }}
          >
            <Input
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Name des Haushalts (z. B. „Zuhause“)"
            />
            <Button type="submit" disabled={!householdName.trim() || createHousehold.isPending}>
              <Plus className="mr-1 h-4 w-4" /> Anlegen
            </Button>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="font-medium">{household.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-warning hover:text-warning"
                onClick={() => removeHousehold.mutate(household.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Haushalt löschen
              </Button>
            </div>

            <ul className="space-y-1">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{member.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-warning hover:text-warning"
                    onClick={() => removeMember.mutate(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              {members.length === 0 && (
                <li className="text-sm text-muted-foreground">Noch keine Mitglieder.</li>
              )}
            </ul>

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (memberName.trim()) addMember.mutate(memberName.trim());
              }}
            >
              <Input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Mitglied hinzufügen"
              />
              <Button type="submit" disabled={!memberName.trim() || addMember.isPending}>
                <UserPlus className="mr-1 h-4 w-4" /> Hinzufügen
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default HouseholdSettings;
