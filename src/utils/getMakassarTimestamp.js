export function getMakassarTimestamp(makassarTime) {
  const year = makassarTime.getFullYear();
  const month = String(makassarTime.getMonth() + 1).padStart(2, "0");
  const day = String(makassarTime.getDate()).padStart(2, "0");

  const hours = String(makassarTime.getHours()).padStart(2, "0");
  const minutes = String(makassarTime.getMinutes()).padStart(2, "0");
  const seconds = String(makassarTime.getSeconds()).padStart(2, "0");
  const milliseconds = String(makassarTime.getMilliseconds()).padStart(6, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}+08`;
}

// export default { getMakassarTimestamp };