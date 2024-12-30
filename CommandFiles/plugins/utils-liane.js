export const meta = {
  name: "utils-liane",
  author: "Liane Cagara",
  version: "1.0.0",
  description:
    "Helpful but optional utilities that isn't used by default, DO NOT OWN THESE",
  supported: "^1.0.0",
  order: 1,
  type: "plugin",
};
import axios from "axios";
import fs from "fs";
const moment = require("moment-timezone");

/**
 * Checks if the current time falls within a specified range.
 *
 * @param {number} msStart - The start time in milliseconds from midnight.
 * @param {number} msEnd - The end time in milliseconds from midnight.
 * @param {string} [timeZone='Asia/Manila'] - The timezone to use (default is Philippines timezone).
 * @returns {boolean} - Returns true if the current time is within the range, otherwise false.
 */
function isTimeAvailable(msStart, msEnd, timeZone = "Asia/Manila") {
  const now = moment.tz(timeZone);

  const msCurrent =
    now.hours() * 60 * 60 * 1000 +
    now.minutes() * 60 * 1000 +
    now.seconds() * 1000 +
    now.milliseconds();

  return msCurrent >= msStart && msCurrent <= msEnd;
}

class ItemLister {
  constructor(inventory) {
    this.inventory = inventory;
  }
  minified(hasKey) {
    return this.raw()
      .map(
        (item) => `${item.icon} ${item.name} ${hasKey ? `(${item.key})` : ""}`,
      )
      .join("\n");
  }
  formal(hasKey) {
    return this.raw()
      .map(
        (item) =>
          `${item.icon} **${item.name}** ${hasKey ? `(${item.key})` : ""}`,
      )
      .join("\n");
  }
  shopStyle(hasKey, hasPrice, priceKey) {
    return this.raw()
      .map((item) => {
        let isOkay = false;
        const price = item[priceKey] ?? item.price;
        if (!isNaN(price) && price > 0) {
          isOkay = true;
        }
        return `${item.icon} **${item.name}**${hasPrice ? ` - ${isOkay ? `$**${item.price}**` : "🚫"}` : ""}\n✦ ${item.flavorText}`;
      })
      .join("\n\n");
  }
  raw() {
    return Array.from(this.inventory);
  }
}

class BulkUpdater {
  constructor(allUsers, { Inventory, GearsManage } = {}) {
    this.allUsers = this.serialClone(allUsers);
    this.Inventory = Inventory;
    this.GearsManage = GearsManage;

    if (!Inventory || !GearsManage) {
      throw new Error("Classes missing.");
    }
  }

  async eachUsers(callback) {
    const users = this.raw();
    for (const userID in users) {
      await callback(userID, users[userID]);
    }
  }

  async mapUsers(callback) {
    const result = {};
    const users = this.raw();
    for (const userID in users) {
      result[userID] = await callback(userID, users[userID]);
    }
    return this.newBulk(result);
  }

  async filterUsers(callback) {
    const result = {};
    const users = this.raw();
    for (const userID in users) {
      if (await callback(userID, users[userID])) {
        result[userID] = users[userID];
      }
    }
    return this.newBulk(result);
  }

  async eachInventory(callback) {
    const result = {};
    const users = this.raw();
    for (const userID in users) {
      const value = this.serialClone(users[userID]);
      const inver = new this.Inventory(value.inventory ?? []);
      const boxer = new this.Inventory(value.boxItems ?? [], 100);
      const trades = new this.Inventory(value.tradeVentory ?? []);
      await callback(userID, inver, boxer, trades);
      value.boxItems = Array.from(boxer);
      value.inventory = Array.from(inver);
      value.tradeVentory = Array.from(trades);
      result[userID] = value;
    }
    return this.newBulk(result);
  }

  async editAllItems(itemKey, replaceData) {
    replaceData = this.serialClone(replaceData);

    const bulk = await this.eachInventory(
      async (userID, inventory, boxInventory, tradeVentory) => {
        const items = inventory.get(itemKey);
        for (const item of items) {
          Object.assign(item, replaceData);
        }
        inventory.deleteRefs(items);
        inventory.add(items);

        const boxItems = boxInventory.get(itemKey);
        for (const item of boxItems) {
          Object.assign(item, replaceData);
        }
        boxInventory.deleteRefs(boxItems);
        boxInventory.add(boxItems);

        const tradeItems = tradeVentory.get(itemKey);
        for (const item of tradeItems) {
          Object.assign(item, replaceData);
        }
        tradeVentory.deleteRefs(tradeItems);
        tradeVentory.add(tradeItems);
      },
    );

    const bulk2 = await bulk.mapUsers(async (userID, value) => {
      value = this.serialClone(value);
      const gearsManage = new this.GearsManage(value.gearsData ?? []);
      for (const { key } of gearsManage) {
        const gearData = gearsManage.getGearData(key);
        for (const weapon of gearData.weaponArray) {
          if (weapon?.key !== itemKey) {
            continue;
          }
          Object.assign(weapon, replaceData);
        }
        for (const armor of gearData.armorsArray) {
          if (armor?.key !== itemKey) {
            continue;
          }
          Object.assign(armor, replaceData);
        }
      }
      value.gearsData = Array.from(gearsManage);
      return value;
    });

    return bulk2;
  }

  async set(userID, data) {
    const existing = this.raw()[userID] ?? {};
    this.raw()[userID] = this.serialClone({ ...existing, ...data });
    return this.raw()[userID];
  }

  async replace(userID, data) {
    this.raw()[userID] = this.serialClone(data);
  }

  async getCopy(userID) {
    return this.serialClone(await this.get(userID));
  }

  async get(userID) {
    return this.raw()[userID] ?? {};
  }

  async clone() {
    return this.newBulk(this.serialClone(this.raw()));
  }

  newBulk(data) {
    return new BulkUpdater(data, {
      Inventory: this.Inventory,
      GearsManage: this.GearsManage,
    });
  }

  raw() {
    return this.allUsers;
  }

  toJSON() {
    return this.raw();
  }

  toUsersArray() {
    const users = [];
    const rawUsers = this.raw();
    for (const userID in rawUsers) {
      const value = rawUsers[userID];
      users.push({
        ...value,
        userID,
      });
    }
    return users;
  }

  serialClone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  static fromUsersArray(usersArray) {
    const userMap = {};
    for (const user of usersArray) {
      const { userID, ...value } = user;
      userMap[userID] = value;
    }
    return new BulkUpdater(userMap);
  }
}
class Slicer {
  constructor(array = [], limit = 10) {
    this.array = Array.from(array);
    this.limit = limit;
  }
  getPage(page) {
    return Slicer.byPageArray(this.array, page, this.limit);
  }
  get pagesLength() {
    return Math.floor(this.array.length / (this.limit || 10))
  }
  static parseNum(page) {
    page = parseInt(page);
    if (isNaN(page)) {
      page = 1;
    }
    return page;
  }

  static byPage(page, limit) {
    page = parseInt(page);
    if (isNaN(page)) {
      page = 1;
    }
    limit = parseInt(limit);
    if (isNaN(limit)) {
      limit = 10;
    }
    const sliceA = (page - 1) * limit;
    const sliceB = page * limit;
    return [sliceA, sliceB];
  }
  static byPageArray(array, page, limit) {
    return array.slice(...this.byPage(page, limit));
  }
}
class CommandProperty {
  constructor(commandName) {
    this.commandName = commandName;

    let [rootCommand, ...nestedProperties] = this.commandName
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);

    let commandProperty = {};

    nestedProperties.reduce((obj, prop, index) => {
      if (nestedProperties[index + 1]) {
        obj[prop] = {};
        return obj[prop];
      } else {
        obj[prop] = true;
        return obj;
      }
    }, commandProperty);

    this[rootCommand] = commandProperty;
  }

  static reverse(obj) {
    if (!obj || typeof obj !== "object") {
      return "";
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return "";
    }

    const firstKey = keys[0];
    const value = obj[firstKey];

    if (typeof value === "object") {
      return firstKey + "." + CommandProperty.reverse(value);
    } else {
      return firstKey;
    }
  }
}

class ArgsHelper extends Array {
  constructor({ body, isCommand } = {}) {
    let array = String(body).split(" ").filter(Boolean);
    let commandName = null;
    if (!!isCommand) {
      commandName = array.shift();
    }
    super(...array);
    this.isCommand = () => !!isCommand;
    this.commandName = () => commandName;
  }
  get commandProperties() {
    return new CommandProperty(this.commandName());
  }
  get properties() {
    const self = this;
    return new Proxy(
      {},
      {
        get(_, prop) {
          return new CommandProperty(self[prop] || "");
        },
        set(_, prop, value) {
          self[prop] =
            typeof value === "object"
              ? CommandProperty.reverse(value)
              : String(value);
          return true;
        },
      },
    );
  }
  set properties(values) {
    if (!Array.isArray(values)) {
      return true;
    }
    for (const index in values) {
      this[index] =
        typeof value === "object"
          ? CommandProperty.reverse(value)
          : String(value);
    }
  }
  on(degree, value, callback) {
    const needed = String(this[degree] || "");
    if (
      typeof value === "string" &&
      needed.toLowerCase() === value.toLowerCase()
    ) {
      callback(needed, value);
    } else if (value instanceof RegExp && value.test(needed)) {
      callback(needed, value);
    }
  }
}
class TagParser {
  constructor(event) {
    this.event = event;
  }

  get args() {
    return new ArgsHelper(this.event);
  }

  static mainParser(str) {
    str = String(str);
    const [, str2] = str.split("[").map((i) => i.trim());
    if (!str2) {
      return null;
    }
    const [str3] = str2.split("]").map((i) => i.trim());
    if (!str3) {
      return null;
    }
    const tags = str3
      .split(",")
      .filter(Boolean)
      .map((tag) => tag.trim())
      .map((tagStr) => {
        const [tag = null, value = null] = tagStr
          .split("=")
          .map((i) => i.trim());
        return {
          tag,
          value,
        };
      })
      .filter((i) => i.tag);
    tags.toObject = () => {
      let result = {};
      for (const tag of tags) {
        result[tag.tag] = tag.value;
      }
      return result;
    };
    return tags;
  }

  getByTag(tagName, index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const tags = TagParser.mainParser(this.args[index]);
    return tags.filter((tag) => tag.tag === tagName);
  }

  getAllTagNames(index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const tags = TagParser.mainParser(this.args[index]);
    const tagNames = tags.map((tag) => tag.tag);
    return [...new Set(tagNames)];
  }

  getValuesByTag(tagName, index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const tags = TagParser.mainParser(this.args[index]);
    return tags.filter((tag) => tag.tag === tagName).map((tag) => tag.value);
  }

  formatTags(index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const tags = TagParser.mainParser(this.args[index]);
    return tags.map((tag) => `${tag.tag}=${tag.value}`).join(", ");
  }

  get(index = 0) {
    return TagParser.mainParser(this.args[index]);
  }

  addTags(newTags, index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const existingTags = TagParser.mainParser(this.args[index]);
    const updatedTags = [...existingTags, ...newTags];
    this.args[index] = `[${updatedTags
      .map((tag) => `${tag.tag}=${tag.value}`)
      .join(", ")}]`;
  }

  removeTagsByName(tagNames, index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const existingTags = TagParser.mainParser(this.args[index]);
    const updatedTags = existingTags.filter(
      (tag) => !tagNames.includes(tag.tag),
    );
    this.args[index] = `[${updatedTags
      .map((tag) => `${tag.tag}=${tag.value}`)
      .join(", ")}]`;
  }

  updateTagValue(tagName, newValue, index = 0) {
    if (index >= this.args.length) {
      throw new Error("Index out of range.");
    }
    const existingTags = TagParser.mainParser(this.args[index]);
    const updatedTags = existingTags.map((tag) =>
      tag.tag === tagName ? { ...tag, value: newValue } : tag,
    );
    this.args[index] = `[${updatedTags
      .map((tag) => `${tag.tag}=${tag.value}`)
      .join(", ")}]`;
  }
}

export async function use(obj) {
  obj.TagParser = TagParser;
  obj.Slicer = Slicer;
  class MessageEditor {
    constructor(event, api) {
      this.api = api || obj.api;
      this.currentID = null;
      this.edits = 0;
      this.event = event || obj.event;
    }
    async apply(content, delay, isReply) {
      delay = Number(delay || 0);
      content = String(content);
      if (!this.currentID) {
        this.currentID = await new Promise(
          (resolve) => {
            this.api.sendMessage(content, this.event.threadID, (_, info) => {
              resolve(info.messageID);
            });
          },
          isReply ? this.event.messageID : undefined,
        );
        return this;
      }
      if (this.edits > 5) {
        return this;
      }
      const self = this;
      await new Promise((resolve) => {
        setTimeout(() => {
          self.api.editMessage(content, self.currentID, () => {
            resolve();
          });
        }, delay);
      });
      return this;
    }
  }

  class Attachment {
    constructor(url, { devLog = false, strictMode = true } = {}) {
      this.url = url;
      this.api = obj.api;
      this.devLog = devLog;
      this.strictMode = strictMode;
      this.stream = null;
      this.event = obj.event;
    }

    async loadUrl(method = "GET", extra = {}) {
      try {
        const response = await axios({
          method: method,
          url: this.url,
          ...extra,
          responseType: "stream",
        });
        this.stream = response.data;
        return this.stream;
      } catch (error) {
        if (this.strictMode) {
          throw error;
        }
        if (this.devLog) {
          console.error(error);
        }
      }
    }
    async send(optionalCaption, optionalThreadID) {
      if (!this.isLoaded()) {
        return api.sendMessage(
          "[Attachment] Image not yet loaded.",
          optionalThreadID || this.event.threadID,
        );
      }
      try {
        const payload = {
          attachment: await this.load(),
        };
        if (optionalCaption) {
          payload.body = String(optionalCaption);
        }
        await api.sendMessage(payload, optionalThreadID || this.event.threadID);
        return payload;
      } catch (error) {
        await api.sendMessage(
          `[Attachment] Failed sending attachment.\n${error instanceof Error ? error.toString() : JSON.stringify(error, null, 2)}`,
        );
        return null;
      }
    }

    async loadFile() {
      try {
        this.stream = await fs.promises.createReadStream(this.url);
        return this.stream;
      } catch (error) {
        if (this.strictMode) {
          throw error;
        }
        if (this.devLog) {
          console.error(error);
        }
      }
    }
    load() {
      if (this.url.startsWith("http")) {
        return this.loadUrl();
      } else {
        return this.loadFile();
      }
    }
    isLoaded() {
      return !!this.stream;
    }

    setDevLog(enabled) {
      this.devLog = enabled;
    }

    setStrictMode(enabled) {
      this.strictMode = enabled;
    }

    isDevLogEnabled() {
      return this.devLog;
    }

    isStrictModeEnabled() {
      return this.strictMode;
    }
  }
  obj.ArgsHelper = ArgsHelper;
  obj.CommandProperty = CommandProperty;
  obj.Attachment = Attachment;
  obj.MessageEditor = MessageEditor;
  obj.MsgEditor = MessageEditor;
  obj.Editor = MessageEditor;
  class GameSimulator {
    constructor({
      key,
      verb = key.charAt(0).toUpperCase() + key.slice(1),
      verbing = verb + "ing",
      pastTense = verb + "ed",
      checkIcon = "✓",
      initialStorage = 30,
      itemData = [],
      actionEmoji = "🔖",
    }) {
      this.key = key;
      this.verb = verb;
      this.verbing = verbing;
      this.pastTense = pastTense;
      this.checkIcon = checkIcon;
      this.actionEmoji = actionEmoji;
      this.storage = initialStorage;
      this.itemData = itemData.map((i) => {
        return {
          ...i,
          priceA: i.priceA * 10,
          priceB: i.priceB * 10,
        };
      });
    }

    async simulateAction(context = obj) {
      try {
        const { input, output, money, args, prefix, CassExpress } = context;
        if (args[0] === "total") {
          const { [this.key + "Total"]: totalItems = {}, name } =
            await money.get(input.senderID);
          if (!name) {
            return output.reply(
              "❌ Please register first using the changename command.",
            );
          }

          let result = `📝 **Total ${this.verb}s Items**:\n\n`;
          const sortedItems = Object.entries(totalItems).sort(
            (a, b) => b[1] - a[1],
          );
          sortedItems.forEach(([itemName, itemCount]) => {
            const data = this.itemData.find((item) => item.name === itemName);
            result += `${this.checkIcon} ${data.icon} **${itemName}**\nSold Amount: ${itemCount}\nRarity: ${100 - data.chance * 100}%\nProcessing Time: ${data.delay} minutes.\nPrice Range:\nBetween ${data.priceA} and ${data.priceB}.\n\n`;
          });
          const totalHarvest = Object.values(totalItems).reduce(
            (acc, count) => acc + count,
            0,
          );
          result += `\n**Total**: ${totalHarvest}`;
          return output.reply(result);
        }

        const currentTimestamp = Date.now();

        const {
          money: userMoney,
          [this.key + "Stamp"]: actionStamp,
          [this.key + "MaxZ"]: actionMax = this.storage,
          [this.key + "Total"]: totalItems = {},
          name,
        } = await money.get(input.senderID);
        if (!name) {
          return output.reply(
            "❌ Please register first using the changename command.",
          );
        }

        let text = "";
        let newMoney = userMoney;
        let totalYield = 0;
        let failYield = 0;

        if (!actionStamp) {
          text = `${this.actionEmoji} Cannot perform ${this.verbing} action since no ${this.verb} is in progress. Starting ${this.verbing} ${this.verb} now, come back later!`;
        } else {
          const elapsedTime = (currentTimestamp - actionStamp) / 1000 / 60;

          let harvestedItems = [];
          for (const item of this.itemData) {
            let yieldAmount = Math.max(0, Math.floor(elapsedTime / item.delay));
            const yieldArray = Array(yieldAmount).fill();
            yieldAmount = yieldArray.reduce(
              (acc) => acc + (Math.random() < item.chance ? 1 : 0),
              0,
            );
            if (totalYield + yieldAmount > actionMax) {
              failYield += totalYield + yieldAmount - actionMax;
              yieldAmount = actionMax - totalYield;
            }

            if (yieldAmount <= 0) {
              continue;
            }
            let price = Math.floor(
              Math.random() * (item.priceB - item.priceA + 1) + item.priceA,
            );
            price = CassExpress.farmUP(price, totalItems);

            totalYield += yieldAmount;
            if (!totalItems[item.name]) {
              totalItems[item.name] = 0;
            }
            totalItems[item.name] += yieldAmount;

            const total = yieldAmount * price;
            harvestedItems.push({
              name: item.name,
              icon: item.icon,
              yieldAmount,
              price,
              total,
            });
            newMoney += total;
          }

          text = `📝 **Summary**:\n`;
          let types = 0;
          harvestedItems = harvestedItems.sort((a, b) => a.total - b.total);
          harvestedItems.forEach((item) => {
            if (item.yieldAmount < 1) {
              return;
            }
            text += `${this.checkIcon} ${item.icon} ${item.yieldAmount} **${item.name}(s)** sold for **${item.price}$** each, total: **${item.total}$**\n`;
            types++;
          });
          if (failYield > 0) {
            text += `🥲 **Failed** ${this.verbing} ${failYield} **item(s)** due to full storage.\n`;
          }
          if (types === 0) {
            text += `\n🥲 No items ${this.pastTense}, you should wait for the next action!\n`;
          } else {
            text += `\n💗 ${this.pastTense} ${types} type(s) of items.\n`;
          }
          text += `\n🗃️ Storage: `;
          text += `${totalYield}/${actionMax}\n✓ You can **upgrade** this storage by checking the **shop**.`;
          text += `\n\n✨ **Total Earnings**: ${newMoney - userMoney}$\n💰 **Your Balance**: ${newMoney}$`;
          text += `\n\n${this.actionEmoji} Starting another ${this.verbing} cycle, please come back after ${Math.floor((currentTimestamp - actionStamp) / 1000 / 60)} minutes if you want to get the same amount of earnings.`;
          text += `\n\nYou can also type ${prefix}${this.key} total`;
        }
        await money.set(input.senderID, {
          money: newMoney,
          [this.key + "Stamp"]: currentTimestamp,
          [this.key + "MaxZ"]: actionMax,
          [this.key + "Total"]: totalItems,
        });

        output.reply(text);
      } catch (error) {
        output.error(error);
      }
    }
  }
  class ItemPrompt {
    constructor(inventory = []) {
      const { output, money, Inventory } = obj;
      this.inv = new Inventory([...inventory]);
    }
    async selectItem({
      format,
      onItem = async function() {},
      head = "",
      bottom = "",
      onWrong,
    } = {}) {
      const { output, money, Inventory } = obj;
      format ??= (inv) => {
        return [...inv].map((item, n) => `${n + 1} ${item.icon} **${item.name}** (${item.key})\n`);
      }
      const self = this;
      return output.waitForReply(`${head}\n${await format(this.inv)}\n${bottom}`.trim(), async (ctx) => {
        const { repObj: { resolve } } = ctx;
        let targetItem = self.inv.find((_, i) => String(i) === String(parseInt(ctx.input.words[0]) + 1));
        if (!targetItem) {
          if (onWrong) {
            return await onWrong(ctx);
          }
          return ctx.output.reply(`❌ Item not found.`);
        }
        let { inventory: newInv } = await ctx.money.get(ctx.input.senderID);
        newInv = new Inventory(newInv);
        if (![...newInv].some(i => i === targetItem)) {
          return ctx.output.reply(`❌ Missing item!`);
        }
        await onItem(ctx, targetItem);
        return resolve(targetItem);
      });
    }
  }
  obj.ItemPrompt = ItemPrompt;
  

  obj.GameSimulator = GameSimulator;
  obj.isTimeAvailable = isTimeAvailable;
  obj.BulkUpdater = BulkUpdater;
  obj.ItemLister = ItemLister;
  obj.next();
}
