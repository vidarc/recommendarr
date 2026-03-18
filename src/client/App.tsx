import { useEffect, useState } from "react";

const intialTime = 0;
const incrementTime = 1;
const timeInterval = 1000;

export const App = () => {
	const [time, setTime] = useState(intialTime);

	useEffect(() => {
		const interval = setInterval(() => {
			setTime((current) => current + incrementTime);
		}, timeInterval);

		return () => {
			clearInterval(interval);
		};
	});

	return <h1>Hello World - {time}</h1>;
};
