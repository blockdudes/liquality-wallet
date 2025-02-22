<template>
  <div class="view-container">
    <div class="send" v-if="currentStep === 'inputs'">
      <NavBar
        showBack="true"
        :backPath="routeSource === 'assets' ? '/wallet' : `/accounts/${account.id}/${asset}`"
        backLabel="Back"
      >
        Send
      </NavBar>
      <div class="wrapper form">
        <div class="wrapper_top">
          <SendInput
            :asset="asset"
            :amount="amount"
            :account="account"
            :amount-fiat="amountFiat"
            @update:amount="(newAmount) => (amount = newAmount)"
            @toggle-max="toggleMaxAmount"
            @update:amountFiat="(amount) => (amountFiat = amount)"
            :max="available"
            :available="available"
            :max-fiat="prettyFiatBalance(available, fiatRates[asset])"
            :amount-error="amountError"
            :max-active="maxOptionActive"
          />
          <div class="form-group mt-40">
            <label for="address">Send to</label>
            <div class="input-group">
              <input
                type="text"
                :class="{ 'is-invalid': address && addressError }"
                v-model="address"
                class="form-control form-control-sm"
                id="address"
                placeholder="Address"
                autocomplete="off"
                required
                @input="getDomainAddress"
              />
            </div>
            <small
              v-if="address && addressError"
              class="text-danger form-text text-right"
              id="address_format_error"
              >{{ addressError }}</small
            >
          </div>
          <div class="form-group mt-20" v-if="showMemoInput">
            <label for="memo">Memo (Optional)</label>
            <div class="input-group">
              <textarea
                type="text"
                v-model="memo"
                class="form-control form-control-sm"
                id="memo"
                autocomplete="off"
                rows="5"
              ></textarea>
            </div>
          </div>
          <div class="form-group mt-150" v-bind:class="[showMemoInput ? 'adjustFeePosition' : '']">
            <DetailsContainer v-if="feesAvailable && isCustomFeeSupported">
              <template v-slot:header>
                <div class="network-header-container">
                  <span class="details-title" id="send_network_speed"> Network Speed/Fee </span>
                  <span class="text-muted" id="send_network_speed_avg_fee">
                    ({{ selectedFeeLabel }} / {{ prettyFee }} {{ assetChain }})
                  </span>
                </div>
              </template>
              <template v-slot:content>
                <ul class="selectors">
                  <li>
                    <div class="send_fees">
                      <span class="selectors-asset">{{ assetChain }}</span>
                      <div class="custom-fees" v-if="customFee">
                        <span v-if="prettyFee.eq(0)"
                          >{{ currentChainAssetFee }} {{ currentChainUnit }}</span
                        >
                        <span v-else>{{ prettyFee }} {{ assetChain }}</span> /
                        {{ totalFeeInFiat }} USD
                        <button class="btn btn-link" @click="resetCustomFee">Reset</button>
                      </div>
                      <FeeSelector
                        v-else
                        :asset="asset"
                        v-model="selectedFee"
                        :fees="assetFees"
                        :totalFees="maxOptionActive ? maxSendFees : sendFees"
                        :fiatRates="fiatRates"
                        @custom-selected="onCustomFeeSelected"
                      />
                    </div>
                  </li>
                </ul>
              </template>
            </DetailsContainer>
            <template v-if="!isCustomFeeSupported">
              <div class="network-header-container">
                <span class="details-title" id="send_network_speed"
                  ><strong> Network Speed/Fee </strong></span
                >
                <span class="text-muted" id="send_network_speed_avg_fee">
                  ({{ prettyFee }} {{ assetChain }})
                </span>
              </div>
            </template>
          </div>
        </div>
        <div class="wrapper_bottom">
          <div class="button-group">
            <router-link
              :to="routeSource === 'assets' ? '/wallet' : `/accounts/${this.account.id}/${asset}`"
            >
              <button class="btn btn-light btn-outline-primary btn-lg" id="send_cancel_button">
                Cancel
              </button>
            </router-link>
            <button
              class="btn btn-primary btn-lg"
              id="send_review_button"
              @click="review"
              :disabled="!canSend"
            >
              Review
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="send" v-else-if="currentStep === 'custom-fees' && !isEIP1559Fees">
      <CustomFees
        @apply="applyCustomFee"
        @update="setCustomFee"
        @cancel="cancelCustomFee"
        :asset="assetChain"
        :selected-fee="selectedFee"
        :fees="assetFees"
        :totalFees="maxOptionActive ? maxSendFees : sendFees"
        :fiatRates="fiatRates"
      />
    </div>
    <div class="send" v-else-if="currentStep === 'custom-fees' && isEIP1559Fees">
      <CustomFeesEIP1559
        @apply="applyCustomFee"
        @update="setCustomFee"
        @cancel="cancelCustomFee"
        :asset="assetChain"
        :selected-fee="selectedFee"
        :fees="assetFees"
        :totalFees="maxOptionActive ? maxSendFees : sendFees"
        :fiatRates="fiatRates"
      />
    </div>
    <div class="send" v-else>
      <NavBar :showBackButton="true" :backClick="back" backLabel="Back"> Send </NavBar>
      <div class="send-confirm wrapper form">
        <div class="wrapper_top form">
          <div>
            <label> Send </label>
            <div class="d-flex align-items-center justify-content-between mt-0">
              <div id="confirm_send_value" class="confirm-value" :style="getAssetColorStyle(asset)">
                {{ dpUI(amount) }} {{ asset }}
              </div>
              <div class="details-text" id="send_value_in_fiat">
                {{ formatFiatUI(amountInFiat) }}
              </div>
            </div>
          </div>
          <div class="detail-group" id="detail_group_network_fee">
            <label class="text-muted"> Network Fee </label>
            <div
              class="d-flex align-items-center justify-content-between mt-0"
              v-show="!updatingFees"
            >
              <div>~{{ prettyFee }} {{ assetChain }}</div>
              <div class="details-text" id="send_network_fee_in_fiat">
                {{ formatFiatUI(totalFeeInFiat) }}
              </div>
            </div>
            <SpinnerIcon class="updating-fees" v-show="updatingFees" />
          </div>
          <div class="detail-group" id="detail_group_account_fee">
            <label class="text-muted"> Amount + Fees </label>
            <div
              class="d-flex align-items-center justify-content-between mt-0"
              v-show="!updatingFees"
            >
              <div class="font-weight-bold" v-if="asset === assetChain">
                {{ dpUI(amountWithFee) }} {{ asset }}
              </div>
              <div class="font-weight-bold" v-else>
                {{ dpUI(amount) }} {{ asset }} + {{ prettyFee }}
                {{ assetChain }}
              </div>
              <div class="font-weight-bold" id="total_to_send_in_fiat">
                {{ formatFiatUI(totalToSendInFiat) }}
              </div>
            </div>
            <SpinnerIcon class="updating-fees" v-show="updatingFees" />
          </div>
          <div class="mt-40">
            <label>Send To</label>
            <p class="confirm-address" id="confirm-address">
              {{ confirmAddress }}
            </p>
          </div>
        </div>
        <div class="wrapper_bottom">
          <div class="button-group">
            <button
              class="btn btn-light btn-outline-primary btn-lg"
              id="edit_send_to_button"
              v-if="!loading"
              @click="showInputsStep"
            >
              Edit
            </button>
            <button
              class="btn btn-primary btn-lg btn-icon"
              id="send_button_confirm"
              @click="send"
              :disabled="loading"
            >
              <SpinnerIcon class="btn-loading" v-if="loading" />
              <template v-else>Send {{ asset }}</template>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modals for ledger prompts -->
    <OperationErrorModal
      :open="sendErrorModalOpen"
      :account="account"
      @close="closeSendErrorModal"
      :error="sendErrorMessage"
    />
    <LedgerSignRequestModal :open="signRequestModalOpen" @close="closeSignRequestModal" />
  </div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'
import _, { debounce } from 'lodash'
import BN from 'bignumber.js'
import cryptoassets from '@liquality/wallet-core/dist/src/utils/cryptoassets'
import { version as walletVersion } from '../../../package.json'
import { currencyToUnit, unitToCurrency, ChainId, getChain } from '@liquality/cryptoassets'
import NavBar from '@/components/NavBar'
import FeeSelector from '@/components/FeeSelector'
import {
  prettyBalance,
  prettyFiatBalance,
  dpUI,
  formatFiatUI,
  fiatToCrypto
} from '@liquality/wallet-core/dist/src/utils/coinFormatter'
import {
  getNativeAsset,
  getAssetColorStyle,
  getFeeAsset
} from '@liquality/wallet-core/dist/src/utils/asset'
import { getAssetIcon } from '@/utils/asset'
import { shortenAddress } from '@liquality/wallet-core/dist/src/utils/address'
import { getSendTxFees, getFeeLabel, feePerUnit } from '@liquality/wallet-core/dist/src/utils/fees'

import SpinnerIcon from '@/assets/icons/spinner.svg'
import DetailsContainer from '@/components/DetailsContainer'
import SendInput from './SendInput'
import LedgerSignRequestModal from '@/components/LedgerSignRequestModal'
import OperationErrorModal from '@/components/OperationErrorModal'
import CustomFees from '@/components/CustomFees'
import CustomFeesEIP1559 from '@/components/CustomFeesEIP1559'
import { ledgerConnectMixin } from '@/utils/hardware-wallet'
import qs from 'qs'
import { UNSResolver } from '@liquality/wallet-core/dist/src/nameResolvers/uns'

export default {
  components: {
    NavBar,
    FeeSelector,
    SpinnerIcon,
    DetailsContainer,
    SendInput,
    OperationErrorModal,
    LedgerSignRequestModal,
    CustomFees,
    CustomFeesEIP1559
  },
  mixins: [ledgerConnectMixin],
  data() {
    return {
      sendFees: {},
      maxSendFees: {},
      eip1559fees: {},
      stateAmount: 0.0,
      stateAmountFiat: 0.0,
      address: null,
      selectedFee: 'average',
      currentStep: 'inputs',
      loading: false,
      maxOptionActive: false,
      sendErrorModalOpen: false,
      signRequestModalOpen: false,
      sendErrorMessage: '',
      customFeeAssetSelected: null,
      customFee: null,
      memo: '',
      updatingFees: false,
      domainData: {},
      domainResolver: null
    }
  },
  mounted() {
    this.domainResolver = new UNSResolver()
  },
  props: {
    asset: String,
    accountId: String
  },
  computed: {
    ...mapState(['activeNetwork', 'activeWalletId', 'fees', 'fiatRates']),
    ...mapGetters('app', ['ledgerBridgeReady']),
    ...mapGetters(['accountItem', 'client', 'suggestedFeePrices']),
    account() {
      return this.accountItem(this.accountId)
    },
    amount: {
      get() {
        return this.stateAmount
      },
      set(newValue) {
        if (newValue && !isNaN(newValue)) {
          this.stateAmount = newValue
        } else {
          this.stateAmount = 0.0
        }
        this.stateAmountFiat = prettyFiatBalance(this.stateAmount, this.fiatRates[this.asset])
      }
    },
    amountFiat: {
      get() {
        return this.stateAmountFiat
      },
      set(newValue) {
        if (!newValue) {
          // keep it as a number instead of string, otherwise the placeholder of input won't appear
          this.stateAmountFiat = 0.0
          this.stateAmount = 0.0
        } else {
          this.stateAmountFiat = newValue
          this.stateAmount = fiatToCrypto(
            this.stateAmountFiat?.replaceAll(',', ''),
            this.fiatRates[this.asset]
          )
        }
      }
    },
    balance() {
      return this.account?.balances[this.asset] || 0
    },
    routeSource() {
      return this.$route.query.source || null
    },
    assetChain() {
      return getFeeAsset(this.asset) || getNativeAsset(this.asset)
    },
    assetFees() {
      const assetFees = {}
      if (this.customFee) {
        assetFees.custom = { fee: this.customFee }
      }

      const fees = this.suggestedFeePrices(this.assetChain)
      if (fees) {
        Object.assign(assetFees, fees)
      }

      return assetFees
    },
    feesAvailable() {
      return this.assetFees && Object.keys(this.assetFees).length
    },
    currentFee() {
      const fees = this.maxOptionActive ? this.maxSendFees : this.sendFees
      return this.selectedFee in fees ? fees[this.selectedFee] : BN(0)
    },
    isValidDomain() {
      return this.domainData[this.address] ? true : false
    },
    getAddressFromDomain() {
      return this.domainData[this.address] ? this.domainData[this.address] : ''
    },
    currentChainAssetFee() {
      const fees = this.assetFees
      return fees[this.selectedFee]?.fee || BN(0)
    },
    currentChainUnit() {
      const { unit } = getChain(this.activeNetwork, cryptoassets[this.asset].chain).fees || ''
      return unit
    },
    isValidAddress() {
      return (
        this.isValidDomain ||
        getChain(this.activeNetwork, cryptoassets[this.asset].chain).isValidAddress(this.address)
      )
    },
    addressError() {
      if (!this.isValidAddress) {
        return 'Wrong format. Please check the address.'
      }
      return null
    },
    amountError() {
      const amount = BN(this.amount)
      if (amount.gt(this.available)) {
        return 'Lower amount. This exceeds available balance.'
      }
      return null
    },
    isCustomFeeSupported() {
      const { supportCustomFees } = getChain(this.activeNetwork, cryptoassets[this.asset].chain)
      return supportCustomFees
    },
    canSend() {
      if (!this.address || this.addressError) return false
      if (BN(this.amount).lte(0) || this.amountError) return false

      return true
    },
    prettyFee() {
      return this.currentFee.dp(6)
    },
    available() {
      if (cryptoassets[this.asset].type === 'erc20') {
        return unitToCurrency(cryptoassets[this.asset], this.balance)
      } else {
        const maxSendFee =
          this.selectedFee in this.maxSendFees ? this.maxSendFees[this.selectedFee] : BN(0)
        const fee = currencyToUnit(cryptoassets[this.assetChain], maxSendFee)
        const available = BN.max(BN(this.balance).minus(fee), 0)
        return unitToCurrency(cryptoassets[this.asset], available)
      }
    },
    amountInFiat() {
      return prettyFiatBalance(this.amount, this.fiatRates[this.asset])
    },
    totalFeeInFiat() {
      return prettyFiatBalance(this.currentFee, this.fiatRates[this.assetChain])
    },
    selectedFeeLabel() {
      return getFeeLabel(this.selectedFee)
    },
    totalToSendInFiat() {
      const total = BN(this.amount).plus(BN(this.currentFee))
      return prettyFiatBalance(total, this.fiatRates[this.asset])
    },
    amountWithFee() {
      return BN(this.amount).plus(BN(this.currentFee))
    },
    isEIP1559Fees() {
      return getChain(this.activeNetwork, cryptoassets[this.asset].chain).EIP1559
    },
    showMemoInput() {
      return cryptoassets[this.asset].chain === ChainId.Terra
    },
    memoData() {
      return this.memo
    },
    confirmAddress() {
      return this.address
        ? this.isValidDomain
          ? `${this.address} (${shortenAddress(this.getAddressFromDomain)})`
          : shortenAddress(this.address)
        : ''
    }
  },
  methods: {
    ...mapActions(['updateFees', 'sendTransaction', 'trackAnalytics']),
    ...mapActions('app', ['startBridgeListener']),
    prettyBalance,
    dpUI,
    formatFiatUI,
    prettyFiatBalance,
    getAssetIcon,
    getAssetColorStyle,
    shortenAddress,
    async _updateSendFees(amount) {
      const sendFees = await getSendTxFees(this.account.id, this.asset, amount, this.customFee)
      if (amount === undefined) {
        this.maxSendFees = sendFees
      } else {
        this.sendFees = sendFees
      }
    },
    updateSendFees: _.debounce(async function (amount) {
      await this._updateSendFees(amount)
    }, 800),
    async updateMaxSendFees() {
      await this._updateSendFees()
    },
    getDomainAddress: debounce(async function () {
      if (!this.isValidDomain) {
        const currentAddress = this.address
        const domainAddress = await this.domainResolver.lookupDomain(
          currentAddress,
          cryptoassets[this.asset]
        )
        if (domainAddress) {
          this.$set(this.domainData, currentAddress, domainAddress)
        }
      }
    }, 500),
    showInputsStep() {
      this.currentStep = 'inputs'
    },
    review() {
      if (this.account?.type.includes('ledger') && this.$route.query?.mode !== 'tab') {
        // open in a new tab
        const sendParams = qs.stringify({
          mode: 'tab',
          selectedFee: this.selectedFee,
          amount: BN(this.amount).toString(),
          address: this.address,
          currentStep: 'confirm',
          maxOptionActive: this.maxOptionActive,
          customFee: this.customFee
        })
        const url = `/index.html#/accounts/${this.accountId}/${this.asset}/send?${sendParams}`
        chrome.tabs.create({ url: browser.runtime.getURL(url) })
      } else {
        this.currentStep = 'confirm'
      }
    },
    async send() {
      this.sendErrorMessage = ''
      this.loading = true
      if (this.account?.type.includes('ledger')) {
        this.signRequestModalOpen = true
        await this.connectLedger()
      }

      try {
        const amountToSend = this.maxOptionActive ? this.available : this.amount

        const amount = currencyToUnit(cryptoassets[this.asset], amountToSend).toString()

        // validate for custom fees
        const fee = this.feesAvailable ? this.assetFees[this.selectedFee].fee : undefined

        const domainAddress = this.getAddressFromDomain
        await this.sendTransaction({
          network: this.activeNetwork,
          walletId: this.activeWalletId,
          asset: this.asset,
          to: domainAddress != '' ? domainAddress : this.address,
          accountId: this.account.id,
          amount,
          fee,
          gas: cryptoassets[this.asset].sendGasLimit,
          feeLabel: this.selectedFee,
          fiatRate: this.fiatRates[this.asset],
          ...(this.showMemoInput && { data: this.memoData })
        })

        this.$router.replace(`/accounts/${this.accountId}/${this.asset}`)
      } catch (error) {
        console.error(error)
        const { message } = error
        this.loading = false
        this.signRequestModalOpen = false
        this.sendErrorMessage = message || error
        this.sendErrorModalOpen = true
      }
    },
    toggleMaxAmount() {
      this.maxOptionActive = !this.maxOptionActive
      if (this.maxOptionActive) {
        this.amount = BN.min(BN(this.available), dpUI(this.available))
      }
    },
    back() {
      this.currentStep = 'inputs'
    },
    closeSendErrorModal() {
      this.sendErrorModalOpen = false
      this.loading = false
    },
    closeSignRequestModal() {
      this.signRequestModalOpen = false
      this.loading = false
    },
    cancelCustomFee() {
      this.currentStep = 'inputs'
      this.selectedFee = 'average'
    },
    setCustomFee: _.debounce(async function ({ fee }) {
      this.customFee = fee
      if (this.maxOptionActive) {
        this.updateMaxSendFees()
      } else {
        this.updateSendFees(this.amount)
      }
    }, 800),
    applyCustomFee({ fee }) {
      const presetFee = Object.entries(this.assetFees).find(
        ([speed, speedFee]) =>
          speed !== 'custom' &&
          (speedFee.fee === fee ||
            (fee.maxPriorityFeePerGas &&
              speedFee.fee.maxPriorityFeePerGas === fee.maxPriorityFeePerGas &&
              speedFee.fee.maxFeePerGas === fee.maxFeePerGas))
      )

      if (presetFee) {
        const [speed] = presetFee
        this.selectedFee = speed
        this.customFee = null
      } else {
        this.updateMaxSendFees()
        this.updateSendFees(this.amount)
        this.customFee = feePerUnit(fee, cryptoassets[this.asset].chain)
        this.selectedFee = 'custom'
      }
      this.currentStep = 'inputs'
    },
    onCustomFeeSelected() {
      this.currentStep = 'custom-fees'
    },
    resetCustomFee() {
      this.customFee = null
      this.selectedFee = 'average'
    }
  },
  async created() {
    // set the route values for tab screen mode
    const sendParams = qs.parse(qs.stringify(this.$route.query))
    if (sendParams.mode === 'tab') {
      const sendParams = qs.parse(qs.stringify(this.$route.query))
      const { amount, address, selectedFee, currentStep, maxOptionActive, customFee } = sendParams
      this.amount = amount
      this.address = address
      if (selectedFee) {
        this.selectedFee = selectedFee
        if (customFee) {
          this.customFee = customFee
          this.applyCustomFee({ fee: customFee })
        }
      }
      if (currentStep) {
        this.currentStep = currentStep
      }
      if (maxOptionActive) {
        this.maxOptionActive = maxOptionActive === 'true' ? true : false
      }
    }
    this.updatingFees = true
    await this.updateFees({ asset: this.assetChain })

    this.updateMaxSendFees()
    this.updateSendFees(this.amount)

    this.updatingFees = false

    await this.trackAnalytics({
      event: `User entered send screen for ${this.asset}`,
      properties: {
        walletVersion,
        category: 'Send/Receive',
        action: 'User on Send screen',
        label: `${this.asset}`
      }
    })
  },
  watch: {
    selectedFee: {
      handler() {
        if (this.maxOptionActive) {
          this.amount = BN.min(BN(this.available), dpUI(this.available))
        }
      },
      deep: true
    },
    amount: function (val) {
      const amount = BN(val)
      const available = dpUI(this.available)

      if (!amount.eq(available)) {
        this.maxOptionActive = false
      }

      this.updateSendFees(this.amount)
    },
    available: function () {
      if (this.maxOptionActive) {
        this.amount = dpUI(this.available)
      }
    }
  }
}
</script>

<style lang="scss">
.send {
  &_asset {
    &.input-group {
      align-items: center;
    }

    &_icon {
      margin-right: 4px;
    }

    input {
      text-align: right;
      margin-left: 12px;
    }
  }

  &_fees {
    display: flex;
    align-items: center;
    font-weight: bold;
    margin: 6px 0;

    .fee-selector {
      margin-left: 6px;
    }

    .selectors-asset {
      width: 70px;
    }

    .custom-fees {
      display: flex;
      align-items: center;
      font-weight: normal;
    }
  }
}

.network-header-container {
  display: flex;
  flex-flow: column;
  gap: 5px;

  .text-muted {
    margin-top: 5px;
  }
}

.adjustFeePosition {
  margin-top: 2rem !important;
}

#memo {
  border: 1px solid #a8aeb7;
  resize: none;
}

/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type='number'] {
  -moz-appearance: textfield;
}

.updating-fees {
  height: 24px;

  circle {
    stroke: #dedede;
  }
}

.details-title {
  font-weight: bold;
  text-transform: uppercase;
  padding-right: 0.5em;
}
</style>
