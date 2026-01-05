export const meta = {
  name: "balance",
  description: "Check in-game balance",
  otherNames: ["bal", "coin", "money"],
  version: "1.1.7",
  usage: "{prefix}{name}",
  category: "Fun",
  author: "Liane Cagara",
  permissions: [0],
  noPrefix: "both",
  waitingTime: 6,
};

export const style = {
  title: "💵 Balance",
  titleFont: "bold",
  contentFont: "fancy",
};

function isBrokenMoney(playerMoney) {
  return !!(
    isNaN(playerMoney) ||
    !isFinite(playerMoney) ||
    playerMoney < 0 ||
    playerMoney > Number.MAX_SAFE_INTEGER
  );
}

function sortUsers(users, top) {
  let result = {};
  let sortedKeys = Object.keys(users).sort(
    (a, b) => Number(users[b].money) - Number(users[a].money),
  );
  if (top) {
    sortedKeys = sortedKeys.slice(0, top);
  }
  for (const key of sortedKeys) {
    result[key] = users[key];
  }
  return result;
}
function getTop(id, users) {
  const sorted = sortUsers(users);
  return Object.keys(sorted).findIndex((key) => key === id) + 1;
}
function totalReducer(totalObj) {
  return Object.values(totalObj).reduce((a, b) => {
    const numA = Number(a);
    const numB = Number(b);

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA + numB;
    } else {
      return numA;
    }
  }, 0);
}
const { parseCurrency: pCy } = global.utils;
export async function entry({
  money,
  input,
  output,
  icon,
  prefix,
  clearCurrStack,
}) {
  if (input.arguments[0] === "reset_force_confirmed") {
    await money.set(input.senderID, { money: 0 });
    output.reply(`Your balance has been reset to 0$`);
    return;
  }
  if (input.arguments[0] === "fix") {
    const { money: playerMoney } = await money.get(input.senderID);
    if (isBrokenMoney(playerMoney)) {
      await money.set(input.senderID, { money: 0 });
      return output.reply(
        `Your broken balance has been reset from ${pCy(playerMoney)} to 0$`,
      );
    } else {
      return output.reply(
        `Your balance is ${pCy(playerMoney)}$ and not broken at all.`,
      );
    }
  }
  if (input.arguments[0] === "top") {
    let { participantIDs = [] } = input;
    if (!Array.isArray(participantIDs)) {
      participantIDs = [];
    }
    const users = await money.getAll();
    for (const userID in users) {
      const maxBalance = money.calcMaxBalance(users, userID);
      /*users[userID].money = Math.min(maxBalance, users[userID].money);*/
      users[userID].maxBalance = maxBalance;
    }
    const topUsers = sortUsers(users, 10);

    let result = `🏆 **Top 10 Users** 🏆\n\n`;
    let index = 1;
    let lastBalance;
    for (const key in topUsers) {
      const isGroup = participantIDs.includes(key);

      const { name = "Chara", money: playerMoney, maxBalance } = topUsers[key];
      const userData = topUsers[key];
      result += `${index === 1 ? "👑" : index < 10 ? `0${index}` : index}${
        index === 1
          ? ` ✦ [font=double_struck]${name
              .split("")
              .map((name) => name.toUpperCase())
              .join(" ")}[:font=double_struck] ✦`
          : `. **${name}**`
      }\n💰 Coin(s): $**${pCy(playerMoney)}**💵\n⚠️ Limit is $${pCy(maxBalance)}💵 (${Math.min(Math.floor((playerMoney / maxBalance) * 100), 100)}%)\n`;
      if (lastBalance) {
        result += `💸 Gap(s): $${pCy(lastBalance - playerMoney)}💵\n`;
      }
      if (isGroup) {
        result += `✅ In Group\n`;
      }
      for (const key in userData) {
        if (
          !key.endsWith("Total") &&
          key !== "totalCrops" &&
          key !== "totalOres"
        ) {
          continue;
        }
        const totalObj = userData[key];
        if (!Object.values(totalObj).every((value) => !isNaN(value))) {
          continue;
        }
        const exKey = key.replace("Total", "");
        const exKeyCap =
          exKey.charAt(0).toUpperCase() + exKey.slice(1).toLowerCase();
        const sum = totalReducer(totalObj);
        result += `✓ ${exKeyCap}(s): ${pCy(sum)}\n`;
      }
      result += `\n`;
      index++;
      lastBalance = playerMoney;
    }
    output.reply(result);
    return;
  }
  let { senderID } = input;
  if (input.replier) {
    ({ senderID } = input.replier);
  }
  if (input.hasMentions) {
    ({ senderID } = input.firstMention);
  }
  if (input.arguments[0]) {
    senderID = input.arguments[0];
  }
  let i;
  if (!input.isWeb) {
    i = await output.reply(`⚙️ Loading...`);
  }
  const allUsers = await money.getAll();
  const maxBalance = money.calcMaxBalance(allUsers, senderID);
  let warn = "";
  const playerMoney = (await allUsers[senderID]) ?? {};
  playerMoney.money ??= 0;
  playerMoney.name ??= "Chara";
  if (isBrokenMoney(playerMoney.money)) {
    warn = `\n\n⚠️ This amount of balance might be broken! Please fix it using "${prefix}balance fix" to ensure that your balance will behave as expected.`;
  }
  //await global.utils.delay(1000);
  const topIndex = getTop(senderID, allUsers);
  let topText = `🏆 **${playerMoney.name}** Top #${topIndex}!\n✓ You can **check** by typing **coin top**.

**Disclaimer**: This is not a real balance, it is all virtual, this cannot be converted into real money.

**Notice**: This is an alternate database, your **original** progress is **SAFE** yet you cannot access it for now.`;
  const targetName = input.hasMentions
    ? /*input.firstMention.name*/ playerMoney.name
    : input.replier
      ? /*input.replier.senderID*/ playerMoney.name
      : input.arguments[0]
        ? playerMoney.name
        : "You";
  if (i) {
    output.edit(
      `${targetName} have $${pCy(playerMoney.money)}💵 in the cassidy chatbot system.${warn}\n\n${topText}`,
      i.messageID,
    );
    clearCurrStack();
    await global.utils.delay(10000);
    output.edit(
      /*`⛔ This message is hidden for safety purposes.`*/ `🏆#${topIndex} **${playerMoney.name}**: $${pCy(playerMoney.money)}💵`,
      i.messageID,
    );
  } else {
    output.reply(
      `${targetName} have $${pCy(playerMoney.money)}💵 in the macky chatbot system.${warn}\n\n${topText}`,
    );
  }
}
