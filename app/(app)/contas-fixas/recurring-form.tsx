"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { parseBRL } from "@/lib/money";
import { suggestBucket } from "@/lib/domain/suggest-bucket";
import type { Bucket } from "@/lib/domain/buckets";
import {
  createRecurringAction,
  updateRecurringAction,
  type RecurringFormInput,
} from "@/actions/recurring";
import { BucketToggle } from "@/components/bucket-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export interface RecurringFormItem {
  id: string;
  description: string;
  amountCents: number;
  bucket: Bucket;
  dayOfMonth: number;
}

type Props =
  | {
      mode: "create";
      /** Server-computed: is the due date of day N already past today? */
      duePassedByDay: Record<number, boolean>;
    }
  | { mode: "edit"; item: RecurringFormItem };

type FieldErrors = Partial<Record<keyof RecurringFormInput, string>>;

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function RecurringForm(props: Props) {
  const item = props.mode === "edit" ? props.item : null;

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(item?.description ?? "");
  const [amount, setAmount] = useState(item ? centsToInput(item.amountCents) : "");
  const [day, setDay] = useState(item ? String(item.dayOfMonth) : "");
  // null until the user taps the toggle / checkbox themselves — until then
  // both follow the description / due day (same pattern as quick entry).
  const [pickedBucket, setPickedBucket] = useState<Bucket | null>(
    item?.bucket ?? null
  );
  const [pickedAlsoThisMonth, setPickedAlsoThisMonth] = useState<boolean | null>(
    null
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const bucket: Bucket =
    pickedBucket ?? (suggestBucket(description) ?? "needs");

  const dayNumber = Number(day);
  const dayIsValid = Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 31;
  const defaultAlsoThisMonth =
    props.mode === "create" && dayIsValid ? !props.duePassedByDay[dayNumber] : false;
  const alsoThisMonth = pickedAlsoThisMonth ?? defaultAlsoThisMonth;

  function reset() {
    if (props.mode === "create") {
      setDescription("");
      setAmount("");
      setDay("");
      setPickedBucket(null);
      setPickedAlsoThisMonth(null);
    }
    setErrors({});
    setFormError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const amountCents = parseBRL(amount);
    if (description.trim() === "") nextErrors.description = "Informe uma descrição";
    if (amountCents === null || amountCents <= 0) {
      nextErrors.amountCents =
        amount.trim() === "" || amountCents === 0
          ? "Informe um valor maior que zero"
          : "Não entendi o valor. Tente algo como 1500 ou 1.500,00";
    }
    if (!dayIsValid) nextErrors.dayOfMonth = "Informe o dia do vencimento (1 a 31)";
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length > 0 || amountCents === null) return;

    const payload: RecurringFormInput = {
      description,
      amountCents,
      bucket,
      dayOfMonth: dayNumber,
    };

    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateRecurringAction(props.item.id, payload)
          : await createRecurringAction({ ...payload, alsoThisMonth });

      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error });
        else setFormError(result.error ?? "Não foi possível salvar");
        return;
      }

      toast.success(props.mode === "edit" ? "Conta fixa atualizada" : "Conta fixa salva");
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {props.mode === "create" ? (
        <SheetTrigger render={<Button className="min-h-11" />}>
          <Plus aria-hidden="true" /> Nova conta
        </SheetTrigger>
      ) : (
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label={`Editar ${props.item.description}`}
            />
          }
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </SheetTrigger>
      )}

      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>
            {props.mode === "edit" ? "Editar conta fixa" : "Nova conta fixa"}
          </SheetTitle>
          <SheetDescription>
            {props.mode === "edit"
              ? "A mudança vale a partir do próximo mês; o que já foi lançado não muda."
              : "Entra sozinha em todo mês, no dia do vencimento."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Descrição" error={errors.description}>
            <Input
              type="text"
              placeholder="Aluguel"
              className="min-h-11 text-base"
              value={description}
              aria-invalid={errors.description ? true : undefined}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="Valor" error={errors.amountCents}>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="1.500,00"
                className="min-h-11 text-base"
                value={amount}
                aria-invalid={errors.amountCents ? true : undefined}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field label="Dia" error={errors.dayOfMonth}>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="10"
                className="min-h-11 text-base"
                value={day}
                aria-invalid={errors.dayOfMonth ? true : undefined}
                onChange={(event) => setDay(event.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>

          <BucketToggle value={bucket} onChange={setPickedBucket} />

          {props.mode === "create" && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={alsoThisMonth}
                onChange={(event) => setPickedAlsoThisMonth(event.target.checked)}
              />
              Lançar também neste mês
            </label>
          )}

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button type="submit" className="min-h-11 w-full" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
      {error && <span className="text-xs font-normal text-destructive">{error}</span>}
    </label>
  );
}
