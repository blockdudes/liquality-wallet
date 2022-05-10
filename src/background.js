import 'setimmediate'
import { random } from 'lodash-es'
import store from './store'
import { wait } from './store/utils'
import cryptoassets from '@liquality/wallet-core/dist/utils/cryptoassets'
import { unitToCurrency } from '@liquality/cryptoassets'
import { prettyFiatBalance } from '@liquality/wallet-core/dist/utils/coinFormatter'
import _ from 'lodash-es'

let prevState = _.cloneDeep(store.state)

function asyncLoop(fn, delay) {
  return wait(delay())
    .then(() => fn())
    .then(() => asyncLoop(fn, delay))
}

function getBalance(state) {
  let total = 0
  state.accounts?.[state.activeWalletId]?.[state.activeNetwork].map((item) => {
    Object.keys(item.balances).map((key) => {
      total += total + Number(item.balances[key])
    })
  })
  return total
}

store.subscribe(async ({ type, payload }, state) => {
  let currentState = _.cloneDeep(state)
  const { dispatch, getters } = store

  switch (type) {
    case 'CREATE_WALLET':
      dispatch('trackAnalytics', {
        event: 'Create wallet',
        properties: {
          label: 'New wallet created'
        }
      })
      break

    case 'CHANGE_ACTIVE_NETWORK':
      dispatch('initializeAddresses', {
        network: state.activeNetwork,
        walletId: state.activeWalletId
      })
      dispatch('updateBalances', {
        network: state.activeNetwork,
        walletId: state.activeWalletId
      })
      dispatch('updateMarketData', { network: state.activeNetwork })

      dispatch('trackAnalytics', {
        event: 'Change Active Network',
        properties: {
          action: 'User changed active network',
          network: state.activeNetwork
        }
      })
      break
    case 'LOCK_WALLET':
      dispatch('trackAnalytics', {
        event: 'Wallet locked',
        properties: {
          category: 'Lock/Unlock',
          action: 'Wallet Locked'
        }
      })
      break
    case 'UNLOCK_WALLET':
      dispatch('trackAnalytics', {
        event: 'Unlock wallet',
        properties: {
          category: 'Lock/Unlock',
          action: 'Wallet Unlocked',
          label: 'import with seed pharse'
        }
      })
      dispatch('app/checkAnalyticsOptIn')
      dispatch('initializeAddresses', {
        network: state.activeNetwork,
        walletId: state.activeWalletId
      })
      dispatch('updateBalances', {
        network: state.activeNetwork,
        walletId: state.activeWalletId
      })
      dispatch('updateFiatRates', { assets: store.getters.allNetworkAssets })
      dispatch('updateMarketData', { network: state.activeNetwork })
      dispatch('checkPendingActions', { walletId: state.activeWalletId })

      asyncLoop(
        () =>
          dispatch('updateBalances', {
            network: state.activeNetwork,
            walletId: state.activeWalletId
          }),
        () => random(400000, 600000)
      )

      asyncLoop(
        () => dispatch('updateFiatRates', { assets: Object.keys(state.fiatRates) }),
        () => random(40000, 60000)
      )

      asyncLoop(
        () => dispatch('updateMarketData', { network: state.activeNetwork }),
        () => random(40000, 60000)
      )
      break
    case 'NEW_SWAP':
      // eslint-disable-next-line no-case-declarations
      let fromAmountValue = unitToCurrency(cryptoassets[payload.swap.from], payload.swap.fromAmount)
      // eslint-disable-next-line no-case-declarations
      let toAmountValue = unitToCurrency(cryptoassets[payload.swap.to], payload.swap.toAmount)

      dispatch('trackAnalytics', {
        event: 'New SWAP',
        properties: {
          category: 'Swaps',
          action: 'Swap Initiated',
          swapFrom: `${payload.swap.from}`,
          swapTo: `${payload.swap.to}`,
          swapProvider: `${payload.swap.provider}`,
          fromAmount: fromAmountValue,
          toAmount: toAmountValue,
          fromAmountFiat: prettyFiatBalance(fromAmountValue, state.fiatRates[payload.swap.from]),
          toAmountFiat: prettyFiatBalance(toAmountValue, state.fiatRates[payload.swap.to])
        }
      })
      break
    case 'NEW_TRASACTION':
      // eslint-disable-next-line no-case-declarations
      const itemDetails = getters.accountItem(payload.transaction.accountId)
      // eslint-disable-next-line no-case-declarations
      const sendValue = unitToCurrency(
        cryptoassets[payload.transaction.from],
        payload.transaction.amount
      )
      dispatch('trackAnalytics', {
        event: 'Send',
        properties: {
          category: 'Send/Receive',
          action: 'Funds sent',
          fiatRate: prettyFiatBalance(sendValue, state.fiatRates[payload.transaction.from]),
          fromAsset: cryptoassets[payload.transaction.from],
          toAsset: cryptoassets[payload.transaction.to],
          fee: `${payload.feeLabel}`,
          typeOfAccount: itemDetails.type,
          nameOfAccount: itemDetails.name
        }
      })
      break
    case 'ADD_EXTERNAL_CONNECTION':
      dispatch('trackAnalytics', {
        event: 'Connect to Dapps',
        properties: {
          category: 'Dapps',
          action: 'Dapp Injected',
          label: `Connect to ${payload.origin} ${payload.chain}`,
          dappOrigin: `${payload.origin}`,
          chain: `${payload.chain}`
        }
      })
      break
    case 'ADD_CUSTOM_TOKEN':
      dispatch('trackAnalytics', {
        event: 'Custom Token Added',
        properties: {
          category: 'Settings',
          action: 'Custom Token Added',
          customTokenName: `${payload.customToken.name}`,
          customTokenChain: `${payload.customToken.chain}`,
          customTokenSymbol: `${payload.customToken.symbol}`,
          label: [
            `${payload.customToken.name}`,
            `${payload.customToken.chain}`,
            `${payload.customToken.symbol}`
          ]
        }
      })
      break
    case 'REMOVE_CUSTOM_TOKEN':
      dispatch('trackAnalytics', {
        event: 'Custom Token Removed',
        properties: {
          category: 'Settings',
          action: 'Custom Token Removed',
          customTokenSymbol: `${payload.symbol}`,
          label: `${payload.symbol}`
        }
      })
      break
    case 'UPDATE_HISTORY':
      // eslint-disable-next-line
      const item = getters.historyItemById(payload.network, payload.walletId, payload.id);
      if (item.type === 'SWAP' && payload.updates) {
        if (payload.updates.status !== 'undefined') {
          dispatch('trackAnalytics', {
            event: 'Swap status change',
            properties: {
              category: 'Swaps',
              action: 'Swap Status changed',
              swapProvider: `${item.provider}`,
              label: `${item.from} to ${item.to}`,
              swapStatus: `${payload.updates.status}`,
              orderId: `${item.orderId}`
            }
          })
        }
      }
      if (item.type === 'SEND' && payload.updates) {
        if (payload.updates.status !== 'undefined') {
          dispatch('trackAnalytics', {
            event: 'Send status change',
            properties: {
              category: 'Send/Receive',
              action: 'Send Status changed',
              asset: `${item.from}`,
              sendStatus: `${payload.updates.status}`
            }
          })
        }
      }
      break
    case 'UPDATE_BALANCE':
      // eslint-disable-next-line no-case-declarations
      let prevBalance = getBalance(prevState)
      // eslint-disable-next-line no-case-declarations
      const newBalance = getBalance(currentState)
      // Only trigger event for the first time when user funds their wallet, any subsequent balance updates are ignored.
      if (prevBalance === 0 && newBalance > prevBalance) {
        await dispatch('trackAnalytics', {
          event: 'User has funds in wallet',
          properties: {
            category: 'Balance',
            action: 'Balance Updated',
            label: 'User already has funds in wallet'
          }
        })
      }
      prevState = currentState
      break
    case 'TOGGLE_EXPERIMENT':
      dispatch('trackAnalytics', {
        event: 'Experiment Toggle',
        properties: {
          category: 'Experiments',
          action: 'Experiment Toggle',
          label: `${payload.name}`
        }
      })
      break
    case 'CHANGE_PASSWORD':
      dispatch('trackAnalytics', {
        event: 'Change Password',
        properties: {
          category: 'Settings',
          action: 'Change Password'
        }
      })
      break
  }
})
