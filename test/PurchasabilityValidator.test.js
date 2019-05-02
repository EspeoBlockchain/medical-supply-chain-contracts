const {
  expectPurchasabilityCodes,
  participants,
  carrierCategories,
  purchasabilityCodes,
} = require('./common');

const PurchasabilityValidator = artifacts.require('PurchasabilityValidator');
const DrugItem = artifacts.require('DrugItem');
const { hexToBytes, randomHex } = web3.utils;


contract('PurchasabilityValidator', (accounts) => {
  const drugItemId = randomHex(32);
  const drugItemIdBytes = hexToBytes(drugItemId);

  const vendor = participants.vendor(accounts[1]);
  const carrier1 = participants.carrier(accounts[2], carrierCategories.Truck);
  const carrier2 = participants.carrier(accounts[3], carrierCategories.Ship);
  const pharmacy = participants.pharmacy(accounts[4]);

  let sut;

  beforeEach(async () => {
    sut = await PurchasabilityValidator.new();
  });

  const logHandover = async (drugItem, from, to) => {
    await drugItem.logHandover(from.id, to.id, to.category);
  };

  const logHandoverFromCarrier = async (drugItem, from, to) => {
    await logHandover(drugItem, from, to);
    const { when } = await drugItem.getLastHandover();
    await drugItem.logTransitConditions(from.id, to.id, when, from.conditions.temperature, from.conditions.category);
  };

  it('should return success code if the drug item is valid for purchase', async () => {
    // given
    const drugItem = await DrugItem.new(drugItemIdBytes, vendor.id, pharmacy.id, pharmacy.category);
    // when
    const actualCodes = await sut.isPurchasable(drugItem.address);
    // then
    expectPurchasabilityCodes(actualCodes).toEqual([purchasabilityCodes.ValidForPurchase]);
  });

  it('should return error code if the drug item is not in a pharmacy', async () => {
    // given
    const drugItem = await DrugItem.new(drugItemIdBytes, vendor.id, carrier1.id, carrier1.category);
    // when
    const actualCodes = await sut.isPurchasable(drugItem.address);
    // then
    expectPurchasabilityCodes(actualCodes).toEqual([purchasabilityCodes.NotInPharmacy]);
  });

  it('should return error code if the drug item was handed over by carriers more than twice', async () => {
    // given
    const drugItem = await DrugItem.new(drugItemIdBytes, vendor.id, carrier1.id, carrier1.category);
    await logHandoverFromCarrier(drugItem, carrier1, carrier2);
    await logHandoverFromCarrier(drugItem, carrier2, carrier1);
    await logHandoverFromCarrier(drugItem, carrier1, carrier2);
    await logHandover(drugItem, carrier2, pharmacy);
    // when
    const actualCodes = await sut.isPurchasable(drugItem.address);
    // then
    expectPurchasabilityCodes(actualCodes).toEqual([purchasabilityCodes.TooManyHandovers]);
  });
});