"""
Regression tests for remainingLoan display after transferred funds are spent.

Problem reported by user:
- Loan money moved from loan account to Toss Bank account via "이동"
- Subsequent withdrawals from Toss Bank were displayed with blank remainingLoan
- remainingLoan should decrease on those withdrawals because money is actually spent
"""

import pytest


class TestRemainingLoanAfterTransferSpend:
    def test_transfer_destination_withdrawal_decrements_running_loan(self):
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()

        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]

        assert 'else if (item.transferFrom)' in func_body, \
            'transferFrom branch should exist for destination-account withdrawals'

        branch_index = func_body.find('else if (item.transferFrom)')
        branch_snippet = func_body[branch_index:branch_index + 250]

        assert 'runningLoan -= item.amount' in branch_snippet, \
            'Destination-account withdrawals should decrement runningLoan'
        assert 'item.remainingLoan = runningLoan' in branch_snippet, \
            'Destination-account withdrawals should display updated remainingLoan'
        assert 'item.remainingLoan = -1' not in branch_snippet, \
            'Destination-account withdrawals should no longer hide remainingLoan'

    def test_transfer_itself_still_does_not_decrement_running_loan(self):
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()

        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]

        branch_index = func_body.find('else if (item.type === "이동")')
        next_branch_index = func_body.find('} else if (item.transferFrom)', branch_index)
        branch_snippet = func_body[branch_index:next_branch_index if next_branch_index > branch_index else branch_index + 120]

        assert 'item.remainingLoan = runningLoan' in branch_snippet, \
            'Transfer rows should preserve runningLoan at the moment of movement'
        assert 'runningLoan -= item.amount' not in branch_snippet, \
            'Transfer row itself should not decrement runningLoan'


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])