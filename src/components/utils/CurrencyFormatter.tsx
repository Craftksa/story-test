type CurrencyFormatterProps = {
	amount: number;
	currency?: string;
};

export default function CurrencyFormatter({ amount, currency = "USD" }: CurrencyFormatterProps) {
	const formatted = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
		minimumFractionDigits: 0,
	}).format(amount);

	return <span>{formatted}</span>;
}
