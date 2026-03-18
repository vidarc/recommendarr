import { useEffect, useState } from "react";

export function App() {
	const [time, setTime] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setTime((current) => current + 1);
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	});

	return <h1>Hello World - ${time}</h1>;
}
