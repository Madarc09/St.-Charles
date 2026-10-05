'use strict';
// The pool's hockey day follows Sudbury time, including daylight-saving changes.
const timeZone='America/Toronto',rolloverHour=4;
const clock=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function gameDate(now=new Date()){
  const parts=Object.fromEntries(clock.formatToParts(now).map(p=>[p.type,p.value]));
  const date=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),12));
  if(Number(parts.hour)<rolloverHour)date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}
module.exports={gameDate,timeZone,rolloverHour};
