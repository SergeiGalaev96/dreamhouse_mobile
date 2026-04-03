import dayjs from "dayjs";

export const formatDate = (date) => {
  if (!date) return "-";
  return dayjs(date).format("DD.MM.YYYY");
};
export const formatTime = (date) => {
  if (!date) return "-";
  return dayjs(date).format("HH:mm");
};

export const formatDateReverse = (date) => {
  if (!date) return "-";
  return dayjs(date).format("YYYY.MM.DD");
};

export const formatDateTime = (date) => {
  if (!date) return "-";
  return dayjs(date).format("DD.MM.YY HH:mm");
};