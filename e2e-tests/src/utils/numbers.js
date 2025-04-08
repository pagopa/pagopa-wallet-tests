
export const randomIntFromInterval = (min, max) => {
  let num = Math.floor(Math.random() * (max - min + 1) + min)
  return num.toString().padStart(12, '0'); // Ensure it's always 12 digits
}
