"""
Regression tests for stopping loan tracking rows after remainingLoan reaches zero.

User-reported bug:
- Export continues with many additional rows even after remainingLoan is already 0.
- Expected: stop at the row that exhausts the loan.
"""

import pytest


class TestTrackMultipleLoansStopWhenExhausted:
    def test_finalized_items_exist_and_break_after_exhaustion(self):
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()

        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]

        assert 'const finalizedItems: TrackedItem[] = []' in func_body, \
            'Should build a finalized item list during remainingLoan recalculation'

        assert 'finalizedItems.push(item);' in func_body, \
            'Each processed item should be added to finalizedItems'

        assert 'if (runningLoan <= 0) {' in func_body and 'break;' in func_body, \
            'Should stop adding rows once runningLoan reaches zero'

    def test_response_uses_finalized_items_not_full_regrouped_list(self):
        with open('/app/src/server/api/routers/transaction.ts', 'r') as f:
            content = f.read()

        func_start = content.find('trackMultipleLoans: protectedProcedure')
        func_body = content[func_start:]

        assert 'trackedItems: finalizedItems' in func_body, \
            'Returned trackedItems should use finalizedItems'
        assert 'usageCount: finalizedItems.filter' in func_body, \
            'usageCount should be based on finalizedItems'
        assert 'const transferCount = finalizedItems.filter' in func_body, \
            'transferCount should be based on finalizedItems'


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])