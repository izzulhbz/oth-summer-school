// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Voting} from "../contracts/Voting.sol";

/**
 * Local tests for Voting, run on Hardhat's in-process EVM.
 *
 * These cost nothing and run in milliseconds, so every rule is verified here
 * before anything is deployed to Hedera Testnet.
 */
contract VotingTest is Test {
    Voting private voting;

    // This test contract deploys Voting, so it becomes the admin.
    address private constant ALICE   = address(0xA11CE);
    address private constant BOB     = address(0xB0B);
    address private constant CAROL   = address(0xCA401);
    address private constant MALLORY = address(0x1A110);

    function setUp() public {
        // The test contract (address(this)) is the deployer → admin.
        voting = new Voting("Pizza", "Pasta", "Sushi");
    }

    /* ---------------------------------------------------------------- */
    /* Construction                                                     */
    /* ---------------------------------------------------------------- */

    function test_ConstructorStoresTopics() public view {
        assertEq(voting.getTopic(0), "Pizza");
        assertEq(voting.getTopic(1), "Pasta");
        assertEq(voting.getTopic(2), "Sushi");
    }

    function test_DeployerBecomesAdmin() public view {
        assertEq(voting.admin(), address(this));
    }

    function test_TalliesStartAtZero() public view {
        assertEq(voting.getVotes(0), 0);
        assertEq(voting.getVotes(1), 0);
        assertEq(voting.getVotes(2), 0);
    }

    function test_EmptyTopicIsRejected() public {
        vm.expectRevert(bytes("Topic A cannot be empty"));
        new Voting("", "Pasta", "Sushi");

        vm.expectRevert(bytes("Topic B cannot be empty"));
        new Voting("Pizza", "", "Sushi");

        vm.expectRevert(bytes("Topic C cannot be empty"));
        new Voting("Pizza", "Pasta", "");
    }

    /* ---------------------------------------------------------------- */
    /* Voting                                                           */
    /* ---------------------------------------------------------------- */

    function test_VoteIncrementsTheChosenTopic() public {
        vm.prank(ALICE);
        voting.vote(1);

        assertEq(voting.getVotes(0), 0);
        assertEq(voting.getVotes(1), 1);
        assertEq(voting.getVotes(2), 0);
        assertTrue(voting.hasVoted(ALICE));
    }

    function test_VotesAccumulateOnTheSameTopic() public {
        vm.prank(ALICE);
        voting.vote(0);
        vm.prank(BOB);
        voting.vote(0);

        assertEq(voting.getVotes(0), 2);
    }

    function test_VoteEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit Voting.VoteCast(ALICE, 2);

        vm.prank(ALICE);
        voting.vote(2);
    }

    function test_CannotVoteTwice() public {
        vm.prank(ALICE);
        voting.vote(0);

        vm.prank(ALICE);
        vm.expectRevert(bytes("Already voted"));
        voting.vote(1);

        // The first vote stands.
        assertEq(voting.getVotes(0), 1);
        assertEq(voting.getVotes(1), 0);
    }

    function test_CannotVoteTwiceEvenForTheSameTopic() public {
        vm.prank(ALICE);
        voting.vote(0);

        vm.prank(ALICE);
        vm.expectRevert(bytes("Already voted"));
        voting.vote(0);
    }

    function test_InvalidTopicIsRejected() public {
        vm.prank(ALICE);
        vm.expectRevert(bytes("Invalid topic index"));
        voting.vote(3);

        // A rejected vote must not consume Alice's one chance.
        assertFalse(voting.hasVoted(ALICE));
    }

    /* ---------------------------------------------------------------- */
    /* Blocklist behaviour                                              */
    /* ---------------------------------------------------------------- */

    function test_BlockedAccountCannotVote() public {
        // address(this) is the admin — no prank needed.
        voting.setBlocked(MALLORY, true);

        assertTrue(voting.blocked(MALLORY));

        vm.prank(MALLORY);
        vm.expectRevert(bytes("Account is blocked"));
        voting.vote(0);
    }

    function test_UnblockingRestoresTheRightToVote() public {
        voting.setBlocked(MALLORY, true);
        voting.setBlocked(MALLORY, false);

        vm.prank(MALLORY);
        voting.vote(0);
        assertEq(voting.getVotes(0), 1);
    }

    function test_BlockingAfterVotingDoesNotEraseTheVote() public {
        vm.prank(ALICE);
        voting.vote(0);

        voting.setBlocked(ALICE, true);

        assertEq(voting.getVotes(0), 1);
    }

    /* ---------------------------------------------------------------- */
    /* Access control                                                   */
    /* ---------------------------------------------------------------- */

    function test_OnlyAdminCanBlock() public {
        vm.prank(MALLORY);
        vm.expectRevert(bytes("Only admin can block"));
        voting.setBlocked(ALICE, true);

        assertFalse(voting.blocked(ALICE));
    }

    function test_ZeroAddressCannotBeBlocked() public {
        vm.expectRevert(bytes("Zero address not allowed"));
        voting.setBlocked(address(0), true);
    }

    /* ---------------------------------------------------------------- */
    /* Results                                                          */
    /* ---------------------------------------------------------------- */

    function test_WinnerIsEmptyBeforeAnyVotes() public view {
        assertEq(voting.winner(), "");
    }

    function test_WinnerReturnsTopicWithMostVotes() public {
        vm.prank(ALICE);
        voting.vote(0); // Pizza
        vm.prank(BOB);
        voting.vote(0); // Pizza
        vm.prank(CAROL);
        voting.vote(1); // Pasta

        assertEq(voting.winner(), "Pizza");
    }

    function test_GetTopicRejectsBadIndex() public {
        vm.expectRevert(bytes("Invalid topic index"));
        voting.getTopic(9);
    }

    function test_GetVotesRejectsBadIndex() public {
        vm.expectRevert(bytes("Invalid topic index"));
        voting.getVotes(9);
    }

    /* ---------------------------------------------------------------- */
    /* Full demo sequence                                               */
    /* ---------------------------------------------------------------- */

    function test_FullDemoSequence() public {
        // 1. admin (this contract) blocks MALLORY
        voting.setBlocked(MALLORY, true);
        assertTrue(voting.blocked(MALLORY));

        // 2. three successful votes
        voting.vote(0);          // admin/deployer → Pizza
        vm.prank(ALICE);
        voting.vote(0);          // ALICE → Pizza
        vm.prank(BOB);
        voting.vote(1);          // BOB → Pasta

        // 3. MALLORY is blocked
        vm.prank(MALLORY);
        vm.expectRevert(bytes("Account is blocked"));
        voting.vote(2);

        // 4. ALICE already voted
        vm.prank(ALICE);
        vm.expectRevert(bytes("Already voted"));
        voting.vote(1);

        // 5. BOB is not the admin
        vm.prank(BOB);
        vm.expectRevert(bytes("Only admin can block"));
        voting.setBlocked(ALICE, true);

        // 6. final results
        assertEq(voting.getVotes(0), 2); // Pizza
        assertEq(voting.getVotes(1), 1); // Pasta
        assertEq(voting.getVotes(2), 0); // Sushi
        assertEq(voting.winner(), "Pizza");
        assertTrue(voting.hasVoted(ALICE));
        assertFalse(voting.hasVoted(MALLORY));
    }
}
